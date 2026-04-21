"""
Additional views layered on top of the original `views.py` to implement the
features required by the InfluConnect CDC v2.0:

- Subscription plans listing / upgrades / cancellation
- Brand validation workflow (admin)
- Onboarding & Media Kit (influencer)
- Contract PDF generation + signature with IP audit
- Stripe-backed escrow (stub) + payment release
- Casting & Ambassador programs
- Social network OAuth stubs + stats sync
- Review moderation (admin)
- Audit log

All Stripe / Email / PDF heavy-lifting is delegated to ``api.services``.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.files.base import ContentFile
from django.db.models import Q, Avg
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import (
    SUBSCRIPTION_PLANS, CONTENT_THEMES, CONTENT_TYPES, SOCIAL_PLATFORMS,
    PAYMENT_METHODS, LANGUAGES, CITIES_FR, COMPLETION_LABELS_FR,
)
from .models import (
    AmbassadorProgram, AuditLog, BrandProfile, Campaign, CampaignProposal,
    CastingApplication, ContractTemplate, ContentSubmission, InfluencerProfile,
    MediaKitImage, Notification, PlatformSettings, Review, SocialNetwork, User,
)
from .serializers import (
    AmbassadorProgramSerializer, AuditLogSerializer, BrandAdminSerializer,
    BrandProfileSerializer, CampaignProposalSerializer, CastingApplicationSerializer,
    ContractTemplateSerializer, InfluencerProfileSerializer, MediaKitImageSerializer,
    ReviewSerializer, SocialNetworkSerializer,
)
from .services import email_service, stripe_service
from .services.completion import compute_influencer_completion
from .services.pdf_service import generate_contract_pdf, generate_media_kit_pdf


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _client_ip(request) -> str | None:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit(actor, action: str, target_type: str = "", target_id: int | None = None,
           metadata: dict | None = None, ip: str | None = None) -> None:
    AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
        ip_address=ip,
    )


def _notify(user, type_: str, title: str, message: str, proposal=None, send_email: bool = False,
            email_subject: str | None = None, email_body: str | None = None) -> None:
    notif = Notification.objects.create(
        user=user, notification_type=type_, title=title, message=message,
        related_proposal=proposal,
    )
    if send_email and user.email:
        ok = email_service.send(
            to=user.email,
            subject=email_subject or f"InfluConnect — {title}",
            body_text=email_body or message,
        )
        if ok:
            notif.email_sent = True
            notif.save(update_fields=["email_sent"])


# ---------------------------------------------------------------------------
# Reference data (subscription plans, content themes, …)
# ---------------------------------------------------------------------------
class SubscriptionPlansView(APIView):
    """Public list of subscription plans (CDC §9.1)."""
    permission_classes = []  # public

    def get(self, request):
        plans = []
        for plan in SUBSCRIPTION_PLANS.values():
            f = plan["features"]
            plans.append({
                "code": plan["id"],
                "name": plan["name"],
                "price_eur": plan["price_eur_monthly"],
                "features": {
                    "campaigns_per_month": "unlimited" if f["concurrent_campaigns"] == -1 else f["concurrent_campaigns"],
                    "contacts": "unlimited" if f["monthly_influencer_contacts"] == -1 else f["monthly_influencer_contacts"],
                    "analytics": "Avancées" if f["advanced_analytics"] else "Basiques",
                    "support": {
                        "none": "Standard",
                        "email_48h": "Email (48h)",
                        "email_phone_24h": "Email & Tél. (24h)",
                    }.get(f["priority_support"], "Standard"),
                    "custom_contracts": f["contract_templates_max"] != 0,
                    "dedicated_manager": f["dedicated_account_manager"],
                },
            })
        return Response({"plans": plans})


class StripeConfigView(APIView):
    """Public endpoint returning the Stripe publishable key + live mode flag."""
    permission_classes = []

    def get(self, request):
        from django.conf import settings
        from .services import stripe_service
        return Response({
            "publishable_key": getattr(settings, "STRIPE_PUBLISHABLE_KEY", "") or "",
            "live": stripe_service.is_live(),
        })


class ReferenceDataView(APIView):
    """Public list of static reference data used by the frontend forms."""
    permission_classes = []

    def get(self, request):
        return Response({
            # Front uses these keys (label = FR display, code = stored value)
            "themes": CONTENT_THEMES,
            "content_types": CONTENT_TYPES,
            "social_platforms": SOCIAL_PLATFORMS,
            "payment_methods": PAYMENT_METHODS,
            "languages": LANGUAGES,
            "cities": CITIES_FR,
            "completion_labels": COMPLETION_LABELS_FR,
            # Legacy aliases (kept for backward-compat with older callers)
            "content_themes": CONTENT_THEMES,
        })


# ---------------------------------------------------------------------------
# Brand subscription management
# ---------------------------------------------------------------------------
class BrandSubscriptionChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.brand_profile
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)

        plan = request.data.get("plan")
        if plan not in SUBSCRIPTION_PLANS:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

        # Stripe stub — create or update subscription
        if not profile.stripe_customer_id:
            profile.stripe_customer_id = stripe_service.create_customer(
                email=request.user.email,
                name=profile.company_name,
            )
        if profile.stripe_subscription_id:
            stripe_service.change_subscription_plan(
                profile.stripe_subscription_id, SUBSCRIPTION_PLANS[plan]["stripe_price_id"],
            )
            action = "subscription_changed"
        else:
            sub = stripe_service.create_subscription(
                profile.stripe_customer_id, SUBSCRIPTION_PLANS[plan]["stripe_price_id"],
            )
            profile.stripe_subscription_id = sub["id"]
            action = "subscription_created"

        profile.subscription_plan = plan
        profile.subscription_active = True
        profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()

        _audit(request.user, action, "BrandProfile", profile.id,
               metadata={"plan": plan}, ip=_client_ip(request))
        _notify(request.user, "subscription_changed", "Abonnement mis à jour",
                f"Votre abonnement a été modifié vers {SUBSCRIPTION_PLANS[plan]['name']}.",
                send_email=True)
        return Response(BrandProfileSerializer(profile).data)


class BrandSubscriptionCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.brand_profile
        if profile.stripe_subscription_id:
            stripe_service.cancel_subscription(profile.stripe_subscription_id)
        profile.subscription_active = False
        profile.save()
        _audit(request.user, "subscription_cancelled", "BrandProfile", profile.id,
               ip=_client_ip(request))
        return Response(BrandProfileSerializer(profile).data)


# ---------------------------------------------------------------------------
# Admin — brand validation workflow (CDC §5.1)
# ---------------------------------------------------------------------------
class AdminPendingBrandsView(generics.ListAPIView):
    serializer_class = BrandAdminSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        status_filter = self.request.query_params.get("status", "pending")
        qs = BrandProfile.objects.select_related("user", "validated_by").order_by("-id")
        if status_filter and status_filter != "all":
            qs = qs.filter(validation_status=status_filter)
        return qs


class AdminBrandApproveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            profile = BrandProfile.objects.select_related("user").get(pk=pk)
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        profile.validation_status = "approved"
        profile.validated_at = timezone.now()
        profile.validated_by = request.user
        # Auto-activate subscription on approval (Stripe stub charge would happen here)
        if profile.subscription_plan and not profile.subscription_active:
            if not profile.stripe_customer_id:
                profile.stripe_customer_id = stripe_service.create_customer(
                    email=profile.user.email, name=profile.company_name,
                )
            sub = stripe_service.create_subscription(
                profile.stripe_customer_id,
                SUBSCRIPTION_PLANS[profile.subscription_plan]["stripe_price_id"],
            )
            profile.stripe_subscription_id = sub["id"]
            profile.subscription_active = True
            profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()

        _audit(request.user, "brand_validated", "BrandProfile", profile.id,
               ip=_client_ip(request))
        _notify(profile.user, "brand_validated", "Compte validé",
                "Votre compte InfluConnect a été validé. Vous pouvez maintenant créer vos campagnes.",
                send_email=True,
                email_body=email_service.send_brand_validated.__doc__ or
                          "Votre compte InfluConnect a été validé.")
        # Use dedicated template
        email_service.send_brand_validated(profile.user.email, profile.company_name)
        return Response(BrandAdminSerializer(profile).data)


class AdminBrandRejectView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            profile = BrandProfile.objects.select_related("user").get(pk=pk)
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"detail": "reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        profile.validation_status = "rejected"
        profile.validation_notes = reason
        profile.validated_at = timezone.now()
        profile.validated_by = request.user
        profile.save()

        _audit(request.user, "brand_rejected", "BrandProfile", profile.id,
               metadata={"reason": reason}, ip=_client_ip(request))
        _notify(profile.user, "brand_rejected", "Inscription refusée",
                f"Motif : {reason}", send_email=True)
        email_service.send_brand_rejected(profile.user.email, profile.company_name, reason)
        return Response(BrandAdminSerializer(profile).data)


# ---------------------------------------------------------------------------
# Influencer onboarding & Media Kit (CDC §4.1 & §4.2)
# ---------------------------------------------------------------------------
class InfluencerOnboardingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        completion = compute_influencer_completion(profile)
        if profile.profile_completion_percent != completion:
            profile.profile_completion_percent = completion
            if completion >= 80 and not profile.onboarding_completed:
                profile.onboarding_completed = True
            profile.save(update_fields=["profile_completion_percent", "onboarding_completed"])
        return Response({
            "completion_percent": completion,
            "onboarding_completed": profile.onboarding_completed,
            "missing_fields": _missing_fields(profile),
        })


def _missing_fields(profile) -> list[str]:
    user = profile.user
    missing: list[str] = []
    if not user.avatar:
        missing.append("avatar")
    if not profile.bio or len(profile.bio.strip()) < 10:
        missing.append("bio")
    if not profile.display_name:
        missing.append("display_name")
    if not user.location:
        missing.append("location")
    if not profile.languages:
        missing.append("languages")
    if not profile.content_themes:
        missing.append("content_themes")
    if not profile.content_types_offered:
        missing.append("content_types_offered")
    if not profile.pricing:
        missing.append("pricing")
    if not profile.social_networks.exists():
        missing.append("social_networks")
    if not (profile.payment_method and profile.payment_details):
        missing.append("payment_method")
    return missing


class MediaKitGenerateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        completion = compute_influencer_completion(profile)
        if completion < 80:
            return Response(
                {"detail": "Profile must be at least 80% complete.", "completion": completion},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pdf_bytes = generate_media_kit_pdf(profile=profile)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"PDF generation failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        filename = f"media_kit_{profile.id}_{timezone.now():%Y%m%d_%H%M%S}.pdf"
        profile.media_kit_pdf.save(filename, ContentFile(pdf_bytes), save=False)
        profile.media_kit_generated_at = timezone.now()
        profile.profile_completion_percent = completion
        profile.onboarding_completed = True
        profile.save()
        return Response(InfluencerProfileSerializer(profile).data)


# ---------------------------------------------------------------------------
# Contract generation & signature (CDC §6)
# ---------------------------------------------------------------------------
class ProposalGenerateContractView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand", "influencer__user"
            ).get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # only the brand for this proposal can request generation
        if (request.user.user_type != "brand"
                or proposal.campaign.brand.user_id != request.user.id):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in ("accepted", "counter_offer"):
            return Response({"detail": "Proposal must be accepted first."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            pdf = generate_contract_pdf(proposal=proposal)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"PDF generation failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        filename = f"contract_prop_{proposal.id}_v{proposal.contract_version}.pdf"
        proposal.contract_pdf.save(filename, ContentFile(pdf), save=False)
        proposal.save()
        for u in (proposal.influencer.user, proposal.campaign.brand.user):
            _notify(u, "contract_ready", "Contrat prêt à signer",
                    f"Le contrat pour « {proposal.campaign.title} » est prêt.",
                    proposal=proposal, send_email=True)
        return Response(CampaignProposalSerializer(proposal).data)


# ---------------------------------------------------------------------------
# Casting (CDC §10.5)
# ---------------------------------------------------------------------------
class CastingListView(generics.ListAPIView):
    """Public castings — open opportunities for influencers to apply to."""
    serializer_class = None  # uses CampaignSerializer indirectly
    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from .serializers import CampaignSerializer
        qs = Campaign.objects.filter(is_casting=True, status="active").order_by("-created_at")
        return Response(CampaignSerializer(qs, many=True).data)


class CastingApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            campaign = Campaign.objects.get(pk=pk, is_casting=True)
        except Campaign.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        profile = request.user.influencer_profile
        if CastingApplication.objects.filter(campaign=campaign, influencer=profile).exists():
            return Response({"detail": "Already applied."}, status=status.HTTP_400_BAD_REQUEST)
        motivation = request.data.get("motivation", "")
        if not motivation:
            return Response({"detail": "motivation is required."},
                            status=status.HTTP_400_BAD_REQUEST)
        app = CastingApplication.objects.create(
            campaign=campaign, influencer=profile,
            motivation=motivation,
            examples=request.data.get("examples", []),
        )
        _notify(campaign.brand.user, "casting_application", "Nouvelle candidature",
                f"{profile.display_name or request.user.username} a postulé à « {campaign.title} ».",
                send_email=True)
        return Response(CastingApplicationSerializer(app).data, status=status.HTTP_201_CREATED)


class CastingApplicationsListView(generics.ListAPIView):
    """Brand-side: list applications received for a casting campaign."""
    serializer_class = CastingApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        pk = self.kwargs["pk"]
        user = self.request.user
        if user.user_type != "brand":
            return CastingApplication.objects.none()
        try:
            campaign = Campaign.objects.get(pk=pk, brand__user=user)
        except Campaign.DoesNotExist:
            return CastingApplication.objects.none()
        return CastingApplication.objects.filter(campaign=campaign).select_related(
            "influencer__user"
        ).order_by("-created_at")


class CastingApplicationDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            app = CastingApplication.objects.select_related(
                "campaign__brand", "influencer__user"
            ).get(pk=pk)
        except CastingApplication.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if (request.user.user_type != "brand"
                or app.campaign.brand.user_id != request.user.id):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        decision = request.data.get("decision")
        if decision not in ("selected", "rejected"):
            return Response({"detail": "Invalid decision."}, status=status.HTTP_400_BAD_REQUEST)
        app.status = decision
        app.decided_at = timezone.now()
        app.save()
        if decision == "selected":
            CampaignProposal.objects.get_or_create(
                campaign=app.campaign, influencer=app.influencer,
                defaults={"proposed_price": app.campaign.price_per_influencer or 0},
            )
        return Response(CastingApplicationSerializer(app).data)


# ---------------------------------------------------------------------------
# Media kit gallery images (portfolio uploads included in PDF)
# ---------------------------------------------------------------------------
class MediaKitImageViewSet(viewsets.ModelViewSet):
    serializer_class = MediaKitImageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = []  # set in __init__ to avoid import cycle

    def get_parsers(self):
        from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
        return [MultiPartParser(), FormParser(), JSONParser()]

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "user_type", None) != "influencer":
            return MediaKitImage.objects.none()
        return MediaKitImage.objects.filter(influencer__user=user)

    def perform_create(self, serializer):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        user = self.request.user
        if getattr(user, "user_type", None) != "influencer":
            raise PermissionDenied("Only influencers can upload media kit images.")
        profile = user.influencer_profile
        if profile.media_kit_images.count() >= 3:
            raise ValidationError({"detail": "Maximum of 3 portfolio images reached."})
        serializer.save(influencer=profile)

    def perform_destroy(self, instance):
        if instance.influencer.user_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Forbidden.")
        if instance.image:
            instance.image.delete(save=False)
        instance.delete()


# ---------------------------------------------------------------------------
# Ambassador programs (CDC §10.1)
# ---------------------------------------------------------------------------
class AmbassadorProgramViewSet(viewsets.ModelViewSet):
    serializer_class = AmbassadorProgramSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "brand":
            return AmbassadorProgram.objects.filter(brand__user=user).order_by("-created_at")
        if user.user_type == "influencer":
            return AmbassadorProgram.objects.filter(influencer__user=user).order_by("-created_at")
        return AmbassadorProgram.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can create ambassador programs.")
        serializer.save(brand=self.request.user.brand_profile)


# ---------------------------------------------------------------------------
# Contract templates (CDC §6.3 — Growth/Pro only)
# ---------------------------------------------------------------------------
class ContractTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ContractTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.user_type != "brand":
            return ContractTemplate.objects.none()
        return ContractTemplate.objects.filter(brand__user=self.request.user).order_by("-id")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can manage contract templates.")
        profile = self.request.user.brand_profile
        if profile.subscription_plan not in ("growth", "pro"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Templates are only available on Growth and Pro plans.")
        serializer.save(brand=profile)

    @staticmethod
    def _docx_to_html(file_obj) -> str:
        try:
            import mammoth
        except ImportError:
            return ""
        result = mammoth.convert_to_html(file_obj)
        return result.value or ""

    @staticmethod
    def _pdf_to_html(file_obj) -> str:
        try:
            from pypdf import PdfReader
        except ImportError:
            return ""
        try:
            reader = PdfReader(file_obj)
        except Exception:
            return ""
        parts: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            for para in text.split("\n\n"):
                para = para.strip()
                if para:
                    # escape basic HTML, convert single \n to <br/>
                    import html as _html
                    safe = _html.escape(para).replace("\n", "<br/>")
                    parts.append(f"<p>{safe}</p>")
        return "\n".join(parts)

    def _import(self, request):
        from rest_framework.exceptions import PermissionDenied, ValidationError
        if request.user.user_type != "brand":
            raise PermissionDenied("Only brands can import templates.")
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "No file provided."})
        name = (upload.name or "").lower()
        if name.endswith(".docx"):
            html = self._docx_to_html(upload)
            kind = "docx"
        elif name.endswith(".pdf"):
            upload.seek(0)
            html = self._pdf_to_html(upload)
            kind = "pdf"
        else:
            raise ValidationError({"file": "Only .docx or .pdf files are supported."})
        upload.seek(0)
        return Response({"body_html": html, "format": kind, "filename": upload.name})

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def import_document(self, request):
        return self._import(request)


# ---------------------------------------------------------------------------
# Social network OAuth + stats sync (CDC §8)
#
# Real OAuth flow:
#   1. POST /api/social-networks/<pk>/oauth-start/ → returns authorize_url
#   2. User is redirected to the platform, approves access
#   3. Platform redirects to /api/social/oauth/callback/<platform>/?code=...&state=...
#   4. Backend exchanges code → encrypts tokens → fetches stats → redirects to
#      frontend at /influencer/profile?social_connected=<platform>
#   5. POST /api/social-networks/<pk>/sync/ refreshes stats on demand
#
# When credentials are not configured for a platform, the view falls back to
# the legacy stub mode (manual stats only, verified_via_api=True for demo).
# ---------------------------------------------------------------------------
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.shortcuts import redirect

from .services.social import get_provider, ProviderError
from .services.social.tokens import decrypt_token, encrypt_token

OAUTH_STATE_MAX_AGE = 600  # seconds (10 min to complete the flow)


def _state_signer() -> TimestampSigner:
    return TimestampSigner(salt="social-oauth")


def _redirect_uri(platform: str) -> str:
    base = getattr(settings, "SOCIAL_OAUTH_REDIRECT_BASE", "http://localhost:8000").rstrip("/")
    return f"{base}/api/social/oauth/callback/{platform}/"


def _save_tokens(sn: SocialNetwork, tokens):
    sn.oauth_access_token = encrypt_token(tokens.access_token)
    sn.oauth_refresh_token = encrypt_token(tokens.refresh_token) if tokens.refresh_token else ""
    if tokens.expires_in:
        sn.oauth_expires_at = timezone.now() + timedelta(seconds=int(tokens.expires_in))
    else:
        sn.oauth_expires_at = None


def _apply_stats(sn: SocialNetwork, stats):
    sn.followers_count = stats.followers_count
    sn.avg_views = stats.avg_views
    sn.engagement_rate = Decimal(str(stats.engagement_rate))
    if stats.profile_url:
        sn.profile_url = stats.profile_url
    sn.last_synced_at = timezone.now()
    sn.verified_via_api = True


class SocialPlatformsView(APIView):
    """Public listing of platforms with OAuth credentials configured."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        from .services.social import available_platforms
        configured = available_platforms()
        return Response({
            "configured": configured,
            "platforms": {
                p: {"oauth_enabled": p in configured}
                for p in ("youtube", "tiktok", "instagram", "facebook", "twitch")
            },
        })


class SocialOAuthStartView(APIView):
    """Return the OAuth authorize URL for the requested social network."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sn = SocialNetwork.objects.get(pk=pk, influencer__user=request.user)
        except SocialNetwork.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        provider = get_provider(sn.platform)
        if provider is None:
            # Stub fallback — legacy behaviour for unconfigured platforms.
            return Response({
                "platform": sn.platform,
                "configured": False,
                "oauth_url": f"https://oauth.influconnect.local/{sn.platform}/start?sn={sn.id}",
                "note": (
                    f"OAuth credentials not configured for {sn.platform}. "
                    "Set the corresponding env vars (e.g. YOUTUBE_CLIENT_ID/SECRET) "
                    "and restart the backend to enable the real flow."
                ),
            })

        state = _state_signer().sign(f"{request.user.id}:{sn.id}:{sn.platform}")
        redirect_uri = _redirect_uri(sn.platform)
        try:
            url = provider.get_authorize_url(state, redirect_uri)
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({
            "platform": sn.platform,
            "configured": True,
            "oauth_url": url,
            "redirect_uri": redirect_uri,
        })


class SocialOAuthCallbackView(APIView):
    """Public callback endpoint hit by the OAuth provider after user consent."""
    permission_classes = []  # public — security is provided by the signed state.
    authentication_classes = []

    def get(self, request, platform):
        frontend = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        target = f"{frontend}/influencer/profile"

        error = request.query_params.get("error")
        if error:
            return redirect(f"{target}?social_error={platform}&reason={error}")

        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            return redirect(f"{target}?social_error={platform}&reason=missing_code")

        try:
            unsigned = _state_signer().unsign(state, max_age=OAUTH_STATE_MAX_AGE)
        except SignatureExpired:
            return redirect(f"{target}?social_error={platform}&reason=expired")
        except BadSignature:
            return redirect(f"{target}?social_error={platform}&reason=bad_state")

        try:
            user_id_str, sn_id_str, expected_platform = unsigned.split(":")
        except ValueError:
            return redirect(f"{target}?social_error={platform}&reason=bad_state")
        if expected_platform != platform:
            return redirect(f"{target}?social_error={platform}&reason=platform_mismatch")

        try:
            sn = SocialNetwork.objects.get(pk=int(sn_id_str), influencer__user_id=int(user_id_str))
        except SocialNetwork.DoesNotExist:
            return redirect(f"{target}?social_error={platform}&reason=not_found")

        provider = get_provider(platform)
        if provider is None:
            return redirect(f"{target}?social_error={platform}&reason=not_configured")

        try:
            tokens = provider.exchange_code(code, _redirect_uri(platform))
            stats = provider.fetch_stats(tokens)
        except ProviderError as exc:
            return redirect(f"{target}?social_error={platform}&reason=api_error&detail={exc}")

        _save_tokens(sn, tokens)
        _apply_stats(sn, stats)
        sn.save()
        return redirect(f"{target}?social_connected={platform}")


class SocialSyncView(APIView):
    """Refresh stats on demand using the stored OAuth token."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sn = SocialNetwork.objects.get(pk=pk, influencer__user=request.user)
        except SocialNetwork.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        provider = get_provider(sn.platform)
        access_token = decrypt_token(sn.oauth_access_token) if sn.oauth_access_token else None

        if provider is None or not access_token:
            # Stub fallback — keep old behaviour so demo still works.
            sn.last_synced_at = timezone.now()
            sn.verified_via_api = True
            sn.save(update_fields=["last_synced_at", "verified_via_api"])
            return Response({
                **SocialNetworkSerializer(sn).data,
                "stub": True,
                "detail": (
                    "Sync simulée — connecte d'abord ton compte via OAuth pour "
                    "importer les vraies statistiques."
                ),
            })

        # Refresh the access token if it has expired.
        from .services.social.base import TokenBundle
        tokens = TokenBundle(
            access_token=access_token,
            refresh_token=decrypt_token(sn.oauth_refresh_token) or "",
            expires_in=None,
        )
        if sn.oauth_expires_at and sn.oauth_expires_at <= timezone.now() and tokens.refresh_token:
            try:
                tokens = provider.refresh_access_token(tokens.refresh_token)
                _save_tokens(sn, tokens)
            except (NotImplementedError, ProviderError):
                pass

        try:
            stats = provider.fetch_stats(tokens)
        except ProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        _apply_stats(sn, stats)
        sn.save()
        return Response(SocialNetworkSerializer(sn).data)


# ---------------------------------------------------------------------------
# Review moderation (CDC §4.6 & §5.8)
# ---------------------------------------------------------------------------
class AdminReviewModerationListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return Review.objects.filter(is_published=False).order_by("-created_at")


class AdminReviewPublishView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        review.is_published = True
        review.moderated_by = request.user
        review.moderated_at = timezone.now()
        review.save()
        _audit(request.user, "review_moderated", "Review", review.id,
               metadata={"action": "publish"}, ip=_client_ip(request))
        return Response(ReviewSerializer(review).data)


class AdminReviewRejectView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            review = Review.objects.get(pk=pk)
        except Review.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        review.delete()
        _audit(request.user, "review_moderated", "Review", pk,
               metadata={"action": "reject"}, ip=_client_ip(request))
        return Response({"detail": "deleted"})


# ---------------------------------------------------------------------------
# Audit log (admin)
# ---------------------------------------------------------------------------
class AdminAuditLogListView(generics.ListAPIView):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor")
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        return qs


# ---------------------------------------------------------------------------
# Stripe Webhook stub
# ---------------------------------------------------------------------------
class StripeWebhookView(APIView):
    """Stub Stripe webhook receiver. In live mode, verify the signature using
    settings.STRIPE_WEBHOOK_SECRET before processing."""
    permission_classes = []

    def post(self, request):
        # In live mode:
        # event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        # then handle event.type accordingly.
        return Response({"received": True})


# ---------------------------------------------------------------------------
# Influencer Stripe Connect onboarding (stub)
# ---------------------------------------------------------------------------
class InfluencerStripeOnboardView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        if not profile.stripe_account_id:
            acct = stripe_service.create_connected_account(email=request.user.email)
            profile.stripe_account_id = acct["id"]
            profile.stripe_onboarding_url = acct["onboarding_url"]
            profile.save()
        return Response({
            "stripe_account_id": profile.stripe_account_id,
            "onboarding_url": profile.stripe_onboarding_url,
        })


# ---------------------------------------------------------------------------
# Public marketplace (CDC §10.8) — list verified influencers without auth
# ---------------------------------------------------------------------------
class PublicMarketplaceView(generics.ListAPIView):
    serializer_class = InfluencerProfileSerializer
    permission_classes = []

    def get_queryset(self):
        return InfluencerProfile.objects.filter(
            is_verified=True, onboarding_completed=True,
        ).select_related("user").prefetch_related("social_networks").order_by("-average_rating")
