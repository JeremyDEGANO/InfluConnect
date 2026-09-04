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
import math
import secrets
import requests

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.db import connections
from django.shortcuts import get_object_or_404
from django.http import FileResponse, HttpResponse
from django.db.models import Q, Count, Sum
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import (
    SUBSCRIPTION_PLANS, CONTENT_THEMES, CONTENT_TYPES, SOCIAL_PLATFORMS,
    PAYMENT_METHODS, LANGUAGES, CITIES_FR, COMPLETION_LABELS_FR,
        COUNTRIES, CITIES_BY_COUNTRY,
)
from .models import (
    AmbassadorProgram, AuditLog, BrandProfile, Campaign, CampaignProposal,
    CampaignVideoTracking, CampaignVideoDailyStats,
    CastingApplication, ContractTemplate, DirectMessage, InfluencerProfile,
    MediaKitImage, Notification, PlatformSettings, Review,
    SocialNetwork, SocialVideo, SocialFraudFlag, User,
    SupportTicket, SupportTicketImage,
    InfluencerReferralInvite,
)
from .serializers import (
    AmbassadorProgramSerializer, AuditLogSerializer, BrandAdminSerializer,
    BrandProfileSerializer, CampaignProposalSerializer, CastingApplicationSerializer,
    ContractTemplateSerializer, InfluencerProfileSerializer, MediaKitImageSerializer,
    ReviewSerializer, SocialNetworkSerializer, SocialVideoSerializer,
    SocialStatsSnapshotSerializer, SocialFraudFlagSerializer,
    CampaignVideoTrackingSerializer,
    SupportTicketSerializer, SupportTicketAdminUpdateSerializer, SupportTicketImageSerializer,
    _validate_influencer_pseudo, sanitize_contract_html, suggest_influencer_pseudos,
    validate_contract_source, validate_pdf, validate_uploaded_file,
)
from .services import email_service, stripe_service
from .services import address_lookup
from .throttling import AddressLookupThrottle
from .services import plans as plans_service
from .views import _brand_users, _notif_text, _conversation_display_name
from .workspace import (
    get_user_role_for_brand,
    resolve_active_brand,
    user_can_access_brand,
)
from .constants import INFLUENCER_COMPLETION_THRESHOLD
from .services.completion import compute_influencer_completion, is_marketplace_ready
from .services.pdf_service import generate_contract_pdf, generate_media_kit_pdf
from .services.insights_reporting import (
    build_campaign_report_payload,
    compute_campaign_emv,
    compute_lookalikes,
    render_report_pdf,
    render_report_pptx,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _client_ip(request) -> str | None:
    # Rightmost X-Forwarded-For entry: appended by our trusted reverse proxy.
    # The leftmost entries are client-controlled and trivially spoofable.
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
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


def _generate_referral_code_if_missing(profile: InfluencerProfile) -> None:
    if profile.referral_code:
        return
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for _ in range(50):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        if not InfluencerProfile.objects.filter(referral_code=code).exists():
            profile.referral_code = code
            profile.save(update_fields=['referral_code'])
            return
    fallback = ''.join(secrets.choice(alphabet) for _ in range(10))
    profile.referral_code = fallback
    profile.save(update_fields=['referral_code'])


class HealthCheckView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        return Response({"ok": True, "service": "influconnect-api"})


class ReadinessCheckView(APIView):
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        db_ok = True
        cache_ok = True
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_ok = False
        try:
            cache.set("health:ready", "1", timeout=5)
            cache_ok = cache.get("health:ready") == "1"
        except Exception:
            cache_ok = False
        ok = db_ok and cache_ok
        return Response(
            {"ok": ok, "database": db_ok, "cache": cache_ok},
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )



class GifProxyView(APIView):
    """Proxy GIPHY search/trending so frontend does not depend on build-time env injection."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        api_key = (getattr(settings, "GIPHY_API_KEY", "") or "").strip()
        if not api_key:
            return Response({"data": [], "detail": "GIPHY API key not configured."})

        query = (request.query_params.get("q") or "").strip()
        try:
            limit = int(request.query_params.get("limit", 24) or 24)
        except ValueError:
            limit = 24
        limit = max(1, min(limit, 50))

        endpoint = "https://api.giphy.com/v1/gifs/search" if query else "https://api.giphy.com/v1/gifs/trending"
        params = {
            "api_key": api_key,
            "limit": limit,
            "rating": "g",
        }
        if query:
            params["q"] = query

        try:
            res = requests.get(endpoint, params=params, timeout=12)
            payload = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
        except Exception:
            return Response({"data": [], "detail": "GIF provider unavailable."}, status=status.HTTP_502_BAD_GATEWAY)

        if res.status_code != 200:
            return Response(
                {
                    "data": [],
                    "detail": payload.get("message") or "GIF provider request failed.",
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"data": payload.get("data", [])})

def _notify(user, type_: str, title: str, message: str, proposal=None, send_email: bool = False,
            email_subject: str | None = None, email_body: str | None = None) -> Notification:
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
    return notif


# ---------------------------------------------------------------------------
# Reference data (subscription plans, content themes, …)
# ---------------------------------------------------------------------------
class SubscriptionPlansView(APIView):
    """Public list of subscription plans (CDC §9.1)."""
    permission_classes = []  # public

    def get(self, request):
        settings_row = PlatformSettings.get_instance()
        annual_discount = float(settings_row.annual_discount_percent or 0)
        commission_rate = float(settings_row.commission_rate or 0)

        plans = []
        for plan in plans_service.get_plan_configs():
            f = dict(plan["features"])
            for key in plans_service.PLATFORM_FEATURE_FIELDS:
                if key in f and not plans_service.is_platform_feature_enabled(key):
                    f[key] = False

            monthly = float(plan["price_eur_monthly"])
            # Floor to whole euros so the public page never shows cents, and derive
            # the total + savings from that rounded value to stay self-consistent.
            annual_monthly_equivalent = math.floor(monthly * (1 - annual_discount / 100))
            annual_total = annual_monthly_equivalent * 12
            plans.append({
                "code": plan["code"],
                "id": plan["code"],
                "name": plan["name"],
                "price_eur": monthly,
                "price_eur_monthly": monthly,
                "price_eur_monthly_billed_annually": annual_monthly_equivalent,
                "price_eur_annual_total": annual_total,
                "annual_savings_eur": round(monthly * 12 - annual_total, 2),
                "annual_months_free": round((monthly * 12 - annual_total) / monthly, 1) if monthly else 0,
                # Raw matrix (admin-configurable) — used by Pricing/Compare pages
                "features": f,
                # Legacy display block kept for backward compatibility
                "display": {
                    "campaigns_per_month": "unlimited" if f["concurrent_campaigns"] == -1 else f["concurrent_campaigns"],
                    "analytics": "Avancées" if f.get("advanced_analytics") else "Basiques",
                    "custom_contracts": f["contract_templates_max"] != 0,
                },
            })
        return Response({
            "plans": plans,
            "feature_defs": plans_service.PLAN_FEATURE_DEFS,
            "public_feature_keys": plans_service.PUBLIC_FEATURE_KEYS,
            "annual_discount_percent": annual_discount,
            "commission_rate": commission_rate,
        })


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


class PublicStatsView(APIView):
    """Real marketplace counters for the landing page (no invented numbers)."""
    permission_classes = []

    def get(self, request):
        creators = InfluencerProfile.objects.filter(
            user__user_type="influencer", user__is_active=True,
        ).count()
        brands = BrandProfile.objects.filter(validation_status="approved").count()
        paid = CampaignProposal.objects.filter(status="paid").aggregate(
            total=Sum("escrow_amount"),
        )["total"] or 0
        return Response({
            "creators": creators,
            "brands": brands,
            "total_paid_eur": float(paid),
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
                "countries": COUNTRIES,
                "cities_by_country": CITIES_BY_COUNTRY,
            "completion_labels": COMPLETION_LABELS_FR,
            # Legacy aliases (kept for backward-compat with older callers)
            "content_themes": CONTENT_THEMES,
        })


class InfluencerPseudoAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw_value = request.query_params.get("value") or request.query_params.get("pseudo") or ""
        profile = None
        if getattr(request.user, "user_type", None) == "influencer":
            try:
                profile = request.user.influencer_profile
            except InfluencerProfile.DoesNotExist:
                profile = None

        cleaned = (raw_value or "").strip()
        if not cleaned:
            return Response({
                "value": raw_value,
                "available": False,
                "valid": False,
                "normalized": "",
                "reason": "empty",
                "reason_code": "empty",
                "suggestions": [],
            })

        try:
            normalized = _validate_influencer_pseudo(cleaned, current_profile=profile)
            available = True
            reason = ""
            reason_code = "available"
            suggestions: list[str] = []
        except ValidationError as exc:
            normalized = cleaned
            available = False
            reason = str(exc.detail[0]) if getattr(exc, "detail", None) else "unavailable"
            lowered = reason.lower()
            if "reserved" in lowered:
                reason_code = "reserved"
            elif "taken" in lowered:
                reason_code = "taken"
            else:
                reason_code = "invalid"
            suggestions = suggest_influencer_pseudos(cleaned, current_profile=profile)

        return Response({
            "value": raw_value,
            "available": available,
            "valid": available,
            "normalized": normalized,
            "reason": reason,
            "reason_code": reason_code,
            "suggestions": suggestions,
        })


# ---------------------------------------------------------------------------
# Brand subscription management
# ---------------------------------------------------------------------------
class BrandSubscriptionChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = resolve_active_brand(request.user, request=request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if get_user_role_for_brand(request.user, profile) not in ("owner", "admin"):
            return Response({"detail": "Only owners/admins can manage the subscription."},
                            status=status.HTTP_403_FORBIDDEN)

        plan = request.data.get("plan") or request.data.get("plan_code")
        if plan not in SUBSCRIPTION_PLANS:
            return Response({"detail": "Invalid plan."}, status=status.HTTP_400_BAD_REQUEST)

        try:
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
        except stripe_service.PaymentConfigurationError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except NotImplementedError:
            return Response({"detail": "Live Stripe subscriptions are not available yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        profile.subscription_plan = plan
        profile.subscription_active = True
        profile.subscription_expires_at = timezone.now() + timedelta(days=30)
        profile.save()

        _audit(request.user, action, "BrandProfile", profile.id,
               metadata={"plan": plan}, ip=_client_ip(request))
        _notify(request.user,
                "subscription_changed",
                _notif_text(request.user, "Abonnement mis à jour", "Subscription updated"),
                _notif_text(
                    request.user,
                    f"Votre abonnement a été modifié vers {SUBSCRIPTION_PLANS[plan]['name']}.",
                    f"Your subscription has been changed to {SUBSCRIPTION_PLANS[plan]['name']}.",
                ),
                send_email=True)
        return Response(BrandProfileSerializer(profile).data)


class BrandSubscriptionCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = resolve_active_brand(request.user, request=request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if get_user_role_for_brand(request.user, profile) not in ("owner", "admin"):
            return Response({"detail": "Only owners/admins can manage the subscription."},
                            status=status.HTTP_403_FORBIDDEN)
        if profile.stripe_subscription_id:
            try:
                stripe_service.cancel_subscription(profile.stripe_subscription_id)
            except stripe_service.PaymentConfigurationError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            except NotImplementedError:
                return Response({"detail": "Live Stripe subscriptions are not available yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        profile.subscription_active = False
        profile.save()
        _audit(request.user, "subscription_cancelled", "BrandProfile", profile.id,
               ip=_client_ip(request))
        return Response(BrandProfileSerializer(profile).data)


# ---------------------------------------------------------------------------
# Admin — brand validation workflow (CDC §5.1)
# ---------------------------------------------------------------------------
class SupportTicketListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportTicketSerializer
    permission_classes = [IsAuthenticated]

    def _target_lang(self):
        """Return the target language code based on the client's Accept-Language header."""
        accept = self.request.headers.get('Accept-Language', '').lower()
        if accept.startswith('en'):
            return 'EN'
        if accept.startswith('fr'):
            return 'FR'
        return ''

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['translate_to'] = self._target_lang()
        return ctx

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.user_type == "admin":
            return SupportTicket.objects.select_related("requester").all()
        return SupportTicket.objects.select_related("requester").filter(requester=self.request.user)

    def perform_create(self, serializer):
        accept = self.request.headers.get('Accept-Language', '').lower()
        source_language = 'EN' if accept.startswith('en') else 'FR' if accept.startswith('fr') else ''
        serializer.save(requester=self.request.user, source_language=source_language)


class SupportTicketImageUploadView(generics.CreateAPIView):
    """POST /support/tickets/<ticket_pk>/images/ — upload une image (max 5)."""
    serializer_class = SupportTicketImageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_ticket(self):
        ticket = get_object_or_404(
            SupportTicket,
            pk=self.kwargs['ticket_pk'],
            requester=self.request.user,
        )
        return ticket

    def create(self, request, *args, **kwargs):
        ticket = self.get_ticket()
        if ticket.images.count() >= 5:
            return Response(
                {'detail': 'Maximum 5 images per ticket.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_uploaded_file(
                image_file, max_bytes=10 * 1024 * 1024,
                extensions={'.jpg', '.jpeg', '.png', '.gif', '.webp'},
            )
        except ValidationError as exc:
            return Response({'image': exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        obj = SupportTicketImage.objects.create(ticket=ticket, image=image_file)
        serializer = SupportTicketImageSerializer(obj, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SupportTicketImageDownloadView(APIView):
    """Serve support images only to requester or admins."""
    permission_classes = [IsAuthenticated]

    def get(self, request, image_id):
        image = get_object_or_404(SupportTicketImage.objects.select_related('ticket__requester'), pk=image_id)
        ticket = image.ticket
        if not (request.user.is_staff or request.user.user_type == 'admin' or ticket.requester_id == request.user.id):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if not image.image:
            return Response({'detail': 'Image not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            image.image.open('rb'),
            as_attachment=False,
            filename=image.image.name.rsplit('/', 1)[-1],
        )


class SupportTicketFollowUpView(APIView):
    """Append a user follow-up note to an existing support ticket."""

    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_pk):
        ticket = get_object_or_404(
            SupportTicket,
            pk=ticket_pk,
            requester=self.request.user,
        )
        message = (request.data.get('message') or '').strip()
        if not message:
            return Response({'detail': 'No message provided.'}, status=status.HTTP_400_BAD_REQUEST)
        timestamp = timezone.now().strftime('%Y-%m-%d %H:%M')
        ticket.message = f"{ticket.message}\n\n[Suivi {timestamp}]\n{message}"
        if ticket.status == 'closed':
            ticket.status = 'open'
        ticket.save(update_fields=['message', 'status', 'updated_at'])
        return Response(SupportTicketSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


class SupportTicketRatingView(APIView):
    """Store a final 1-5 rating for a closed support ticket."""

    permission_classes = [IsAuthenticated]

    def post(self, request, ticket_pk):
        ticket = get_object_or_404(
            SupportTicket,
            pk=ticket_pk,
            requester=self.request.user,
        )
        if ticket.status != 'closed':
            return Response({'detail': 'Ticket must be closed before rating.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rating = int(request.data.get('rating'))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid rating.'}, status=status.HTTP_400_BAD_REQUEST)
        if rating < 1 or rating > 5:
            return Response({'detail': 'Rating must be between 1 and 5.'}, status=status.HTTP_400_BAD_REQUEST)
        ticket.rating = rating
        ticket.rated_at = timezone.now()
        ticket.save(update_fields=['rating', 'rated_at', 'updated_at'])
        return Response(SupportTicketSerializer(ticket, context={'request': request}).data, status=status.HTTP_200_OK)


class AdminSupportTicketUpdateView(generics.RetrieveUpdateAPIView):
    serializer_class = SupportTicketAdminUpdateSerializer
    permission_classes = [IsAdminUser]
    queryset = SupportTicket.objects.select_related("requester").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        accept = self.request.headers.get('Accept-Language', '').lower()
        if accept.startswith('en'):
            ctx['translate_to'] = 'EN'
        elif accept.startswith('fr'):
            ctx['translate_to'] = 'FR'
        else:
            ctx['translate_to'] = ''
        return ctx


class AdminOverviewView(APIView):
    """Consolidated admin cockpit metrics + lists for operations."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            next_month_start = month_start.replace(year=month_start.year + 1, month=1)
        else:
            next_month_start = month_start.replace(month=month_start.month + 1)

        # Secondary environments (multi-société) are BrandProfile rows owned by an
        # inactive `ws_*@workspace.local` stub user, created from an existing
        # company and copying its plan. They are not customers of their own:
        # counting them would double-bill every KPI and revenue projection, so
        # every admin metric below is scoped to real companies only.
        real_companies = BrandProfile.objects.exclude(user__email__endswith='@workspace.local')
        billable_companies = real_companies.filter(validation_status='approved')

        # Admin-configured prices (DB overrides over constants defaults)
        plan_prices = {
            plan['code']: Decimal(str(plan.get('price_eur_monthly', 0)))
            for plan in plans_service.get_plan_configs()
        }

        active_plan_counts = {
            plan_id: billable_companies.filter(
                subscription_active=True,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        approved_not_active_plan_counts = {
            plan_id: billable_companies.filter(
                subscription_active=False,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        pending_validation_plan_counts = {
            plan_id: real_companies.filter(
                validation_status='pending',
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        pending_plan_counts = {
            plan_id: approved_not_active_plan_counts[plan_id] + pending_validation_plan_counts[plan_id]
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }

        agency_active_plan_counts = {
            plan_id: billable_companies.filter(
                is_agency=True,
                subscription_active=True,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }
        agency_non_active_plan_counts = {
            plan_id: billable_companies.filter(
                is_agency=True,
                subscription_active=False,
                subscription_plan=plan_id,
            ).count()
            for plan_id in SUBSCRIPTION_PLANS.keys()
        }

        def _monthly_revenue(queryset) -> Decimal:
            """Billed monthly revenue for a set of companies.

            Uses the negotiated per-brand price when there is one, otherwise the
            admin-configured plan price (Admin -> Plans & tarifs).
            """
            total = Decimal('0')
            for plan_code, override in queryset.values_list('subscription_plan', 'subscription_price_override'):
                if override is not None:
                    total += Decimal(str(override))
                else:
                    total += plan_prices.get(plan_code or '', Decimal('0'))
            return total

        # Only a live subscription is revenue. Everything else is a company
        # still on the free tier (they can test until they contract), so
        # counting their plan price would invent money we do not bill.
        subscribed = billable_companies.filter(subscription_active=True)
        mrr_active = _monthly_revenue(subscribed)

        # Potential, deliberately kept apart from MRR and NOT dated: these
        # companies convert whenever they contract their first collaboration,
        # which may be next month or never.
        approved_not_subscribed = billable_companies.filter(subscription_active=False)
        pending_validation = real_companies.filter(validation_status='pending')
        potential_approved = _monthly_revenue(approved_not_subscribed)
        potential_pending = _monthly_revenue(pending_validation)

        # Kept for the existing payload shape; `projected_this_month` is now
        # strictly the billed MRR.
        projected_this_month = mrr_active
        projected_next_month = mrr_active + potential_approved + potential_pending

        brands_qs = real_companies.select_related('user', 'validated_by').annotate(
            active_members_count=Count('memberships', filter=Q(memberships__status='active'), distinct=True),
            campaigns_count=Count('campaigns', distinct=True),
        ).order_by('-user__created_at')

        users_qs = User.objects.select_related('brand_profile', 'influencer_profile').order_by('-created_at')

        live_campaigns_qs = Campaign.objects.select_related('brand').filter(status='active').annotate(
            proposals_total=Count('proposals', distinct=True),
            proposals_in_progress=Count('proposals', filter=Q(proposals__status='in_progress'), distinct=True),
        ).order_by('deadline', '-created_at')[:20]

        support_open = SupportTicket.objects.exclude(status='closed').count()
        support_stale_48h = SupportTicket.objects.filter(
            status__in=['open', 'in_progress'],
            created_at__lt=now - timedelta(hours=48),
        ).count()

        proposal_status_counts = {
            row['status']: row['count']
            for row in CampaignProposal.objects.values('status').annotate(count=Count('id')).order_by()
        }

        brands_data = []
        for b in brands_qs:
            created_at = b.user.created_at
            days_since_signup = max((now - created_at).days, 0) if created_at else 0
            brands_data.append({
                'id': b.id,
                'company_name': b.company_name,
                'email': b.user.email,
                'owner_name': (f"{b.user.first_name} {b.user.last_name}".strip() or b.user.username),
                'website': b.website,
                'sector': b.sector,
                'siret': b.siret,
                'validation_status': b.validation_status,
                'subscription_plan': b.subscription_plan,
                'subscription_active': b.subscription_active,
                'subscription_expires_at': b.subscription_expires_at,
                'subscription_price_override': float(b.subscription_price_override) if b.subscription_price_override is not None else None,
                'plan_price_monthly': float(
                    b.subscription_price_override
                    if b.subscription_price_override is not None
                    else plan_prices.get(b.subscription_plan or '', Decimal('0'))
                ),
                'team_size': int(b.active_members_count or 0) + 1,
                'campaigns_count': int(b.campaigns_count or 0),
                'created_at': created_at,
                'days_since_signup': days_since_signup,
                'validated_by_username': b.validated_by.username if b.validated_by else '',
                'validation_notes': b.validation_notes,
            })

        users_data = []
        for u in users_qs:
            brand_profile = getattr(u, 'brand_profile', None)
            users_data.append({
                'id': u.id,
                'name': (f"{u.first_name} {u.last_name}".strip() or u.username),
                'email': u.email,
                'user_type': u.user_type,
                'is_active': u.is_active,
                'language_preference': u.language_preference,
                'phone': u.phone,
                'location': u.location,
                'totp_enabled': u.totp_enabled,
                'last_login': u.last_login,
                'created_at': u.created_at,
                'company_name': brand_profile.company_name if brand_profile else '',
                'subscription_plan': brand_profile.subscription_plan if brand_profile else '',
                'subscription_active': bool(brand_profile.subscription_active) if brand_profile else False,
            })

        live_campaigns_data = []
        for c in live_campaigns_qs:
            live_campaigns_data.append({
                'id': c.id,
                'title': c.title,
                'brand_company_name': c.brand.company_name,
                'status': c.status,
                'deadline': c.deadline,
                'price_per_influencer': c.price_per_influencer,
                'max_influencers': c.max_influencers,
                'proposals_total': int(c.proposals_total or 0),
                'proposals_in_progress': int(c.proposals_in_progress or 0),
                'created_at': c.created_at,
            })

        return Response({
            'kpis': {
                'users_total': User.objects.count(),
                'users_new_last_30d': User.objects.filter(created_at__gte=now - timedelta(days=30)).count(),
                'brands_total': real_companies.count(),
                'agencies_total': real_companies.filter(is_agency=True).count(),
                'agencies_with_plan': real_companies.filter(is_agency=True).exclude(subscription_plan__isnull=True).exclude(subscription_plan='').count(),
                'brands_pending_validation': real_companies.filter(validation_status='pending').count(),
                'brands_active_subscription': billable_companies.filter(subscription_active=True).count(),
                'workspaces_total': BrandProfile.objects.filter(user__email__endswith='@workspace.local').count(),
                'influencers_total': User.objects.filter(user_type='influencer').count(),
                'campaigns_total': Campaign.objects.count(),
                'campaigns_live': Campaign.objects.filter(status='active').count(),
                'support_tickets_open': support_open,
                'support_tickets_stale_48h': support_stale_48h,
            },
            'subscription_projection': {
                'currency': 'EUR',
                # Billed today.
                'mrr_active': float(mrr_active),
                'active_subscriptions': subscribed.count(),
                # Not billed: free-tier companies that could convert. No date
                # attached on purpose — conversion is triggered by contracting.
                'potential_approved_eur': float(potential_approved),
                'potential_approved_count': approved_not_subscribed.count(),
                'potential_pending_eur': float(potential_pending),
                'potential_pending_count': pending_validation.count(),
                'month_start': month_start,
                'next_month_start': next_month_start,
                'projected_this_month': float(projected_this_month),
                'projected_next_month': float(projected_next_month),
                'delta_next_vs_this': float(projected_next_month - projected_this_month),
                'active_plan_counts': active_plan_counts,
                'pending_plan_counts': pending_plan_counts,
                'approved_not_active_plan_counts': approved_not_active_plan_counts,
                'pending_validation_plan_counts': pending_validation_plan_counts,
                'agency_active_plan_counts': agency_active_plan_counts,
                'agency_non_active_plan_counts': agency_non_active_plan_counts,
            },
            'proposal_status_counts': proposal_status_counts,
            'brands': brands_data,
            'users': users_data,
            'live_campaigns': live_campaigns_data,
        })


class AddressAutocompleteView(APIView):
    """Address suggestions for the profile forms.

    Authenticated only: this proxies free public geocoders, so it must not be
    an open relay.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [AddressLookupThrottle]

    def get(self, request):
        query = request.query_params.get("q") or ""
        country = request.query_params.get("country") or "FR"
        # kind=city powers the influencer form, which stores a city only.
        kind = (request.query_params.get("kind") or "address").lower()
        try:
            if kind == "city":
                results = address_lookup.search_cities(query, country=country, limit=5)
            else:
                results = address_lookup.search(query, country=country, limit=5)
        except address_lookup.AddressLookupError:
            # Suggestions are an assist, never a blocker: let the user type on.
            return Response(
                {"results": [], "detail": "Address lookup is temporarily unavailable."},
                status=status.HTTP_200_OK,
            )
        return Response({"results": results})


class AdminHistoryView(APIView):
    """Month-by-month history for the admin cockpit charts.

    `?months=3|6|12` (default 6). Every series is derived from real
    timestamps, so an empty month is a real zero, never a gap.
    """
    permission_classes = [IsAdminUser]
    ALLOWED_MONTHS = (3, 6, 12)

    def get(self, request):
        try:
            months = int(request.query_params.get('months', 6))
        except (TypeError, ValueError):
            months = 6
        if months not in self.ALLOWED_MONTHS:
            months = 6

        now = timezone.now()
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Month boundaries, oldest first, ending with the current (partial) month.
        starts = []
        cursor = current_month_start
        for _ in range(months):
            starts.append(cursor)
            cursor = (cursor - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        starts.reverse()
        bounds = []
        for index, start in enumerate(starts):
            end = starts[index + 1] if index + 1 < len(starts) else None
            bounds.append((start, end))

        commission_rate = Decimal(str(PlatformSettings.get_instance().commission_rate or 0))
        real_companies = BrandProfile.objects.exclude(user__email__endswith='@workspace.local')

        def _window(queryset, field, start, end):
            filters = {f'{field}__gte': start}
            if end is not None:
                filters[f'{field}__lt'] = end
            return queryset.filter(**filters)

        points = []
        for start, end in bounds:
            # Revenue actually collected: commission on released escrow.
            released = _window(
                CampaignProposal.objects.filter(escrow_released=True), 'escrow_released_at', start, end,
            )
            gmv = released.aggregate(total=Sum('escrow_amount'))['total'] or Decimal('0')
            commission = (Decimal(str(gmv)) * commission_rate / Decimal('100')).quantize(Decimal('0.01'))

            proposals = _window(CampaignProposal.objects.all(), 'created_at', start, end)
            # Budget committed by brands over the month (escrow funded).
            funded = _window(
                CampaignProposal.objects.filter(escrow_funded=True), 'escrow_funded_at', start, end,
            )
            budget = funded.aggregate(total=Sum('escrow_amount'))['total'] or Decimal('0')

            points.append({
                'month': start.date().isoformat(),
                'label': f'{start.year}-{start.month:02d}',
                'is_current_month': end is None,
                # Revenue
                'gmv_eur': float(gmv),
                'commission_eur': float(commission),
                # Influencers actually working that month
                'active_influencers': (
                    _window(
                        CampaignProposal.objects.filter(
                            status__in=['contract_signed', 'in_progress', 'content_submitted', 'validated', 'paid'],
                        ),
                        'created_at', start, end,
                    ).values('influencer_id').distinct().count()
                ),
                # Campaigns & proposals
                'campaigns_created': _window(Campaign.objects.all(), 'created_at', start, end).count(),
                'proposals_sent': proposals.count(),
                'proposals_accepted': proposals.filter(
                    status__in=['accepted', 'contract_signed', 'in_progress', 'content_submitted', 'validated', 'paid'],
                ).count(),
                'budget_committed_eur': float(budget),
                # Growth
                'new_companies': _window(real_companies, 'user__created_at', start, end).count(),
                'new_influencers': _window(
                    User.objects.filter(user_type='influencer'), 'created_at', start, end,
                ).count(),
            })

        return Response({
            'months': months,
            'currency': 'EUR',
            'commission_rate': float(commission_rate),
            'points': points,
        })


class AdminUserStatusUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.id == request.user.id:
            return Response({'detail': 'Cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        is_active = request.data.get('is_active', None)
        if is_active is None:
            return Response({'detail': 'is_active is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = bool(is_active)
        user.save(update_fields=['is_active'])

        _audit(
            request.user,
            'admin_user_status_update',
            'User',
            user.id,
            metadata={'is_active': user.is_active},
            ip=_client_ip(request),
        )
        return Response({'id': user.id, 'is_active': user.is_active})


class AdminUserUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if not user:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.id == request.user.id and request.data.get('is_active') is False:
            return Response({'detail': 'Cannot deactivate yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed = {'email', 'phone', 'location', 'language_preference', 'is_active'}
        changed = {}

        for key in allowed:
            if key not in request.data:
                continue
            value = request.data.get(key)
            if key == 'language_preference':
                value = str(value or '').lower().strip()
                if value not in {'fr', 'en'}:
                    return Response({'detail': 'language_preference must be fr or en.'}, status=status.HTTP_400_BAD_REQUEST)
            if key == 'email':
                value = str(value or '').strip().lower()
                if not value:
                    return Response({'detail': 'email cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)
                if User.objects.exclude(pk=user.pk).filter(email=value).exists():
                    return Response({'detail': 'email already in use.'}, status=status.HTTP_400_BAD_REQUEST)
            if key == 'is_active':
                value = bool(value)
            if key in {'phone', 'location'}:
                value = str(value or '').strip()

            old = getattr(user, key)
            if old != value:
                setattr(user, key, value)
                changed[key] = {'old': old, 'new': value}

        if changed:
            user.save(update_fields=list(changed.keys()))
            _audit(
                request.user,
                'admin_user_status_update',
                'User',
                user.id,
                metadata={'fields': changed},
                ip=_client_ip(request),
            )

        return Response({
            'id': user.id,
            'email': user.email,
            'phone': user.phone,
            'location': user.location,
            'language_preference': user.language_preference,
            'is_active': user.is_active,
        })


class AdminPendingBrandsView(generics.ListAPIView):
    serializer_class = BrandAdminSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        status_filter = self.request.query_params.get("status", "pending")
        qs = BrandProfile.objects.select_related("user", "validated_by").order_by("-id")
        if status_filter and status_filter != "all":
            qs = qs.filter(validation_status=status_filter)
        if status_filter == "pending":
            # Only expose brands that actually completed onboarding and submitted for review.
            ready_ids = []
            for profile in qs:
                if not _brand_missing_fields(profile):
                    ready_ids.append(profile.id)
            return BrandProfile.objects.select_related("user", "validated_by").filter(id__in=ready_ids).order_by("-id")
        return qs


class AdminBrandUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        profile = BrandProfile.objects.select_related('user').filter(pk=pk).first()
        if not profile:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        allowed = {
            'company_name', 'website', 'sector', 'description', 'validation_notes', 'validation_status',
            'subscription_plan', 'subscription_price_override',
            'siret', 'billing_address', 'billing_postal_code', 'billing_city', 'billing_country',
        }
        changed = {}

        for key in allowed:
            if key not in request.data:
                continue
            value = request.data.get(key)
            if key == 'validation_status':
                value = str(value or '').strip().lower()
                if value not in {'pending', 'approved', 'rejected'}:
                    return Response({'detail': 'validation_status must be pending, approved or rejected.'}, status=status.HTTP_400_BAD_REQUEST)
            elif key == 'subscription_plan':
                value = str(value or '').strip().lower()
                if value not in SUBSCRIPTION_PLANS:
                    return Response({'detail': f'subscription_plan must be one of {list(SUBSCRIPTION_PLANS)}.'}, status=status.HTTP_400_BAD_REQUEST)
            elif key == 'subscription_price_override':
                if value in (None, ''):
                    value = None
                else:
                    try:
                        value = plans_service.validate_price(value)
                    except ValueError as e:
                        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            else:
                value = str(value or '').strip()

            old = getattr(profile, key)
            if old != value:
                setattr(profile, key, value)
                # Decimal values are not JSON-serializable for the audit metadata
                changed[key] = {
                    'old': str(old) if isinstance(old, Decimal) else old,
                    'new': str(value) if isinstance(value, Decimal) else value,
                }

        if changed:
            if 'validation_status' in changed:
                profile.validated_at = timezone.now()
                profile.validated_by = request.user
            profile.save(update_fields=list(changed.keys()) + (['validated_at', 'validated_by'] if 'validation_status' in changed else []))
            _audit(
                request.user,
                'brand_validated' if changed.get('validation_status', {}).get('new') == 'approved' else 'brand_rejected' if changed.get('validation_status', {}).get('new') == 'rejected' else 'subscription_changed',
                'BrandProfile',
                profile.id,
                metadata={'fields': changed},
                ip=_client_ip(request),
            )

        return Response(BrandAdminSerializer(profile).data)


class AdminBrandApproveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            profile = BrandProfile.objects.select_related("user").get(pk=pk)
        except BrandProfile.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if profile.validation_status == "approved":
            return Response(BrandAdminSerializer(profile).data)
        missing = _brand_missing_fields(profile)
        if missing:
            return Response(
                {"detail": "Brand onboarding is incomplete.", "missing_fields": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.validation_status = "approved"
        profile.validated_at = timezone.now()
        profile.validated_by = request.user
        profile.save()

        _audit(request.user, "brand_validated", "BrandProfile", profile.id,
               ip=_client_ip(request))
        notif = _notify(
            profile.user, "brand_validated",
            _notif_text(profile.user, "Compte validé", "Account approved"),
            _notif_text(
                profile.user,
                "Votre compte InfluConnect a été validé. Vous pouvez maintenant créer vos campagnes.",
                "Your InfluConnect account has been approved. You can now create your campaigns.",
            ),
        )
        # Single dedicated template email (avoids sending a duplicate generic email).
        if profile.user.email:
            sent = email_service.send_brand_validated(
                profile.user.email,
                profile.company_name,
                language=profile.user.language_preference,
            )
            if sent:
                notif.email_sent = True
                notif.save(update_fields=["email_sent"])
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
        notif = _notify(
            profile.user, "brand_rejected",
            _notif_text(profile.user, "Inscription refusée", "Registration rejected"),
            _notif_text(profile.user, f"Motif : {reason}", f"Reason: {reason}"),
        )
        # Single dedicated template email (avoids sending a duplicate generic email).
        if profile.user.email:
            sent = email_service.send_brand_rejected(
                profile.user.email,
                profile.company_name,
                reason,
                language=profile.user.language_preference,
            )
            if sent:
                notif.email_sent = True
                notif.save(update_fields=["email_sent"])
        return Response(BrandAdminSerializer(profile).data)


# ---------------------------------------------------------------------------
# Brand onboarding (CDC §5.1) — required fields & submit-for-validation
# ---------------------------------------------------------------------------
BRAND_REQUIRED_FIELDS = [
    "company_name", "siret", "website", "sector", "description", "logo",
    # Needed to issue a compliant invoice, so it is required up front
    # rather than chased after the first campaign.
    "billing_address", "billing_postal_code", "billing_city",
]


def _brand_missing_fields(profile):
    missing = []
    for f in BRAND_REQUIRED_FIELDS:
        val = getattr(profile, f, None)
        if f == "logo":
            if not val:
                missing.append(f)
        else:
            if not (val or "").strip() if isinstance(val, str) else not val:
                missing.append(f)
    return missing


class BrandOnboardingStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = resolve_active_brand(request.user, request=request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        missing = _brand_missing_fields(profile)
        effective_status = profile.validation_status
        # A newly created brand can start with DB status=pending; expose it as draft
        # until onboarding is complete and explicitly submitted.
        if profile.validation_status == "pending" and missing:
            effective_status = "draft"
        email_verified = bool(request.user.email_verified)
        return Response({
            "validation_status": effective_status,
            "validation_notes": profile.validation_notes,
            "missing_fields": missing,
            "email_verified": email_verified,
            "ready_to_submit": len(missing) == 0 and email_verified,
            "can_create_campaigns": profile.validation_status == "approved",
        })


class BrandSubmitForValidationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = resolve_active_brand(request.user, request=request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        if profile.validation_status == "approved":
            return Response({"detail": "Already approved."}, status=status.HTTP_400_BAD_REQUEST)
        # Our team reviews this file and emails the outcome: a confirmed
        # address is the precondition for the whole workflow.
        if not request.user.email_verified:
            return Response(
                {
                    "detail": "Confirmez votre adresse email avant de soumettre votre dossier.",
                    "code": "email_not_verified",
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        missing = _brand_missing_fields(profile)
        if missing:
            return Response(
                {"detail": "Missing required fields.", "missing_fields": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Reset to pending (covers re-submission after rejection)
        profile.validation_status = "pending"
        profile.validation_notes = ""
        profile.validated_at = None
        profile.validated_by = None
        profile.save(update_fields=[
            "validation_status", "validation_notes", "validated_at", "validated_by",
        ])
        _audit(request.user, "brand_submitted_for_validation", "BrandProfile", profile.id,
               ip=_client_ip(request))
        return Response({
            "validation_status": profile.validation_status,
            "missing_fields": [],
            "ready_to_submit": True,
            "can_create_campaigns": False,
        })


class CampaignLookalikeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        campaign = Campaign.objects.filter(pk=pk).select_related("brand").first()
        if not campaign or not user_can_access_brand(request.user, campaign.brand):
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            reference_influencer_id = int(request.data.get("reference_influencer_id") or 0)
        except (TypeError, ValueError):
            reference_influencer_id = 0
        if reference_influencer_id <= 0:
            return Response({"detail": "reference_influencer_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            limit = int(request.data.get("limit") or 20)
        except (TypeError, ValueError):
            limit = 20

        try:
            min_score = float(request.data.get("min_score") or 0.35)
        except (TypeError, ValueError):
            min_score = 0.35

        rows = compute_lookalikes(
            campaign=campaign,
            reference_influencer_id=reference_influencer_id,
            limit=limit,
            min_score=min_score,
        )

        return Response({
            "campaign_id": campaign.id,
            "reference_influencer_id": reference_influencer_id,
            "count": len(rows),
            "results": rows,
        })


class CampaignEmvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        campaign = Campaign.objects.filter(pk=pk).select_related("brand").first()
        if not campaign or not user_can_access_brand(request.user, campaign.brand):
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = compute_campaign_emv(campaign)
        return Response(payload)


class CampaignReportExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        campaign = Campaign.objects.filter(pk=pk).select_related("brand").first()
        if not campaign or not user_can_access_brand(request.user, campaign.brand):
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        output_format = str(request.data.get("format") or "pptx").strip().lower()
        report = build_campaign_report_payload(campaign)

        if output_format == "pdf":
            data = render_report_pdf(report)
            ext = "pdf"
            content_type = "application/pdf"
        elif output_format in {"pptx", "google_slides"}:
            # Google Slides can import native PPTX files directly.
            data = render_report_pptx(report)
            ext = "pptx"
            content_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        else:
            return Response({"detail": "format must be one of: pdf, pptx, google_slides."}, status=status.HTTP_400_BAD_REQUEST)

        filename = f"campaign_{campaign.id}_report.{ext}"
        response = HttpResponse(data, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        _audit(
            request.user,
            "subscription_changed",
            "Campaign",
            campaign.id,
            metadata={"export_format": output_format, "filename": filename},
            ip=_client_ip(request),
        )

        return response


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
            if completion >= INFLUENCER_COMPLETION_THRESHOLD and not profile.onboarding_completed:
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
    if not profile.media_kit_images.exists():
        missing.append("media_kit_images")
    if not profile.collaboration_pitch or len(profile.collaboration_pitch.strip()) < 20:
        missing.append("collaboration_pitch")
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
        if completion < INFLUENCER_COMPLETION_THRESHOLD:
            return Response(
                {
                    "detail": f"Profile must be at least {INFLUENCER_COMPLETION_THRESHOLD}% complete.",
                    "completion": completion,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not profile.collaboration_pitch or len(profile.collaboration_pitch.strip()) < 20:
            return Response(
                {"detail": "Remplissez la case 'Pourquoi collaborer avec vous ?' dans votre profil avant de générer le kit média."},
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
        profile.media_kit_is_custom = False
        profile.profile_completion_percent = completion
        profile.onboarding_completed = True
        profile.save()
        return Response(InfluencerProfileSerializer(profile).data)


class MediaKitUploadView(APIView):
    """Allow influencer to upload their own media kit PDF (overrides generator)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        f = request.FILES.get("file")
        if not f:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_pdf(f)
        except ValidationError as exc:
            return Response({"detail": exc.detail}, status=status.HTTP_400_BAD_REQUEST)
        profile = request.user.influencer_profile
        filename = f"media_kit_custom_{profile.id}_{timezone.now():%Y%m%d_%H%M%S}.pdf"
        profile.media_kit_pdf.save(filename, f, save=False)
        profile.media_kit_generated_at = timezone.now()
        profile.media_kit_is_custom = True
        profile.save(update_fields=["media_kit_pdf", "media_kit_generated_at", "media_kit_is_custom"])
        return Response(InfluencerProfileSerializer(profile, context={"request": request}).data)

    def delete(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = request.user.influencer_profile
        if profile.media_kit_pdf:
            profile.media_kit_pdf.delete(save=False)
        profile.media_kit_pdf = None
        profile.media_kit_generated_at = None
        profile.media_kit_is_custom = False
        profile.save(update_fields=["media_kit_pdf", "media_kit_generated_at", "media_kit_is_custom"])
        return Response({"detail": "Media kit removed."})


# ---------------------------------------------------------------------------
# Contract generation & signature (CDC §6)
# ---------------------------------------------------------------------------
class ProposalGenerateContractView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand", "campaign__contract_template", "influencer__user", "contract_template"
            ).get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        # only the brand team for this proposal can request generation
        if (request.user.user_type != "brand"
                or get_user_role_for_brand(request.user, proposal.campaign.brand) not in ("owner", "admin")):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status not in ("accepted", "counter_offer"):
            return Response({"detail": "Proposal must be accepted first."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Free until the first signed collaboration: contracting is the paywall.
        if not bool(getattr(proposal.campaign.brand, "subscription_active", False)):
            return Response(
                {
                    "detail": "Choisissez votre formule pour contractualiser cette collaboration et sécuriser le paiement.",
                    "code": "subscription_required",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        
        # Optional: brand can specify which template to use
        template_id = request.data.get("template_id")
        if template_id:
            try:
                template = ContractTemplate.objects.get(pk=template_id, brand=proposal.campaign.brand)
                proposal.contract_template = template
            except ContractTemplate.DoesNotExist:
                return Response({"detail": "Template not found or unauthorized."},
                                status=status.HTTP_400_BAD_REQUEST)
        # If no template specified, use the campaign template first, then the brand default.
        elif not proposal.contract_template:
            campaign_template = getattr(proposal.campaign, "contract_template", None)
            if campaign_template and campaign_template.brand_id == proposal.campaign.brand_id:
                proposal.contract_template = campaign_template
            else:
                default_template = ContractTemplate.objects.filter(
                    brand=proposal.campaign.brand, is_default=True
                ).first()
                if default_template:
                    proposal.contract_template = default_template
        
        try:
            pdf = generate_contract_pdf(proposal=proposal)
        except Exception as exc:  # noqa: BLE001
            return Response({"detail": f"PDF generation failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        filename = f"contract_prop_{proposal.id}_v{proposal.contract_version}.pdf"
        proposal.contract_pdf.save(filename, ContentFile(pdf), save=False)
        proposal.save()
        # Only notify influencer that contract is ready for signing
        influencer_user = proposal.influencer.user
        notif = _notify(
            influencer_user, "contract_ready",
            _notif_text(influencer_user, "Contrat prêt à signer", "Contract ready to sign"),
            _notif_text(
                influencer_user,
                f"La marque a généré le contrat pour « {proposal.campaign.title} ». Veuillez le relire et le signer.",
                f'The brand has generated the contract for "{proposal.campaign.title}". Please review and sign it.',
            ),
            proposal=proposal,
        )
        if influencer_user.email:
            sent = email_service.send_contract_ready_for_signature(
                influencer_user.email,
                "influencer",
                proposal.campaign.title,
                language=influencer_user.language_preference,
            )
            if sent:
                notif.email_sent = True
                notif.save(update_fields=["email_sent"])
        brand_contacts = _brand_users(proposal.campaign.brand)
        if brand_contacts and brand_contacts[0].email:
            email_service.send_contract_ready_for_signature(
                brand_contacts[0].email,
                "brand",
                proposal.campaign.title,
                language=brand_contacts[0].language_preference,
            )
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
        qs = Campaign.objects.filter(is_casting=True, status="active").select_related("brand").order_by("-created_at")
        ugc = (request.query_params.get("ugc") or "").lower()
        if ugc in ("1", "true", "yes"):
            qs = qs.filter(is_ugc=True)
        elif ugc in ("0", "false", "no"):
            qs = qs.filter(is_ugc=False)
        return Response(CampaignSerializer(qs, many=True, context={"request": request}).data)


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
        applicant_name = _conversation_display_name(request.user)
        for recipient in _brand_users(campaign.brand):
            _notify(recipient,
                    "casting_application",
                    _notif_text(recipient, "Nouvelle candidature", "New application"),
                    _notif_text(
                        recipient,
                        f"{applicant_name} a postulé à « {campaign.title} ».",
                        f'{applicant_name} applied to "{campaign.title}".',
                    ),
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
        campaign = Campaign.objects.filter(pk=pk).select_related("brand").first()
        if not campaign or not user_can_access_brand(user, campaign.brand):
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
                or not user_can_access_brand(request.user, app.campaign.brand)):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if get_user_role_for_brand(request.user, app.campaign.brand) not in ("owner", "admin"):
            return Response({"detail": "Only workspace owners/admins can decide applications."}, status=status.HTTP_403_FORBIDDEN)
        decision = request.data.get("decision")
        if decision not in ("selected", "rejected"):
            return Response({"detail": "Invalid decision."}, status=status.HTTP_400_BAD_REQUEST)
        app.status = decision
        app.decided_at = timezone.now()
        app.save()
        if decision == "selected":
            CampaignProposal.objects.get_or_create(
                campaign=app.campaign, influencer=app.influencer,
                defaults={
                    "proposed_price": app.campaign.price_per_influencer or 0,
                    "contract_template": app.campaign.contract_template,
                },
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
        if not plans_service.is_platform_feature_enabled("ambassador_programs"):
            return AmbassadorProgram.objects.none()
        user = self.request.user
        if user.user_type == "brand":
            brand = resolve_active_brand(user, request=self.request)
            if brand is None:
                return AmbassadorProgram.objects.none()
            return AmbassadorProgram.objects.filter(brand=brand).order_by("-created_at")
        if user.user_type == "influencer":
            return AmbassadorProgram.objects.filter(influencer__user=user).order_by("-created_at")
        return AmbassadorProgram.objects.all().order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can create ambassador programs.")
        brand = resolve_active_brand(self.request.user, request=self.request)
        if brand is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No brand workspace.")
        if get_user_role_for_brand(self.request.user, brand) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can create ambassador programs.")
        plans_service.require_platform_feature("ambassador_programs")
        plans_service.require_feature(brand, "ambassador_programs")
        serializer.save(brand=brand)

    def perform_update(self, serializer):
        plans_service.require_platform_feature("ambassador_programs")
        instance = serializer.instance
        if get_user_role_for_brand(self.request.user, instance.brand) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can update ambassador programs.")
        serializer.save()

    def perform_destroy(self, instance):
        plans_service.require_platform_feature("ambassador_programs")
        if get_user_role_for_brand(self.request.user, instance.brand) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can delete ambassador programs.")
        instance.delete()


# ---------------------------------------------------------------------------
# Contract templates (CDC §6.3 — Growth/Pro only)
# ---------------------------------------------------------------------------
class ContractTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = ContractTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.user_type != "brand":
            return ContractTemplate.objects.none()
        brand = resolve_active_brand(self.request.user, request=self.request)
        if brand is None:
            return ContractTemplate.objects.none()
        return ContractTemplate.objects.filter(brand=brand).order_by("-id")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only brands can manage contract templates.")
        profile = resolve_active_brand(self.request.user, request=self.request)
        if profile is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No brand workspace.")
        if get_user_role_for_brand(self.request.user, profile) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can manage contract templates.")
        max_templates = plans_service.get_limit(profile, "contract_templates_max")
        if max_templates == 0:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Les modèles de documents ne sont pas inclus dans votre abonnement.")
        plans_service.enforce_limit(
            profile, "contract_templates_max",
            ContractTemplate.objects.filter(brand=profile).count(),
        )
        serializer.save(brand=profile)

    def perform_update(self, serializer):
        instance = serializer.instance
        if get_user_role_for_brand(self.request.user, instance.brand) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can manage contract templates.")
        serializer.save()

    def perform_destroy(self, instance):
        if get_user_role_for_brand(self.request.user, instance.brand) not in ("owner", "admin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only workspace owners/admins can manage contract templates.")
        instance.delete()

    @staticmethod
    def _docx_to_html(file_obj) -> str:
        try:
            import mammoth
        except ImportError:
            return ""
        try:
            result = mammoth.convert_to_html(file_obj)
        except Exception:
            return ""
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
        validate_contract_source(upload)
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

        html = sanitize_contract_html(html)
        if not html.strip():
            raise ValidationError({
                "file": "Could not extract content from this file. Please verify the file is a valid .docx/.pdf document.",
            })

        upload.seek(0)
        return Response({"body_html": html, "format": kind, "filename": upload.name})

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def import_document(self, request):
        return self._import(request)

    @action(detail=True, methods=["get"], url_path="source-file")
    def source_file(self, request, pk=None):
        template = self.get_object()
        if not template.source_file:
            return Response({'detail': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(
            template.source_file.open('rb'),
            as_attachment=True,
            filename=template.source_file.name.rsplit('/', 1)[-1],
        )


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
    sn.token_status = "active"


def _apply_stats(sn: SocialNetwork, stats):
    sn.followers_count = stats.followers_count
    sn.avg_views = stats.avg_views
    sn.engagement_rate = Decimal(str(stats.engagement_rate))
    if stats.profile_url and (not sn.profile_url or "vm.tiktok.com" in sn.profile_url):
        sn.profile_url = stats.profile_url
    extra = getattr(stats, "extra", {}) or {}
    if extra.get("open_id"):
        sn.external_user_id = str(extra["open_id"])[:128]
    if extra.get("username"):
        sn.external_username = str(extra["username"])[:128]
    if extra.get("display_name"):
        sn.display_name = str(extra["display_name"])[:255]
    if extra.get("avatar_url"):
        sn.avatar_url = str(extra["avatar_url"])[:600]
    if extra.get("bio") is not None:
        sn.bio = str(extra.get("bio") or "")
    if "is_verified" in extra:
        sn.is_verified_external = bool(extra["is_verified"])
    if "video_count" in extra:
        try:
            sn.video_count = int(extra["video_count"] or 0)
        except (TypeError, ValueError):
            pass
    if "likes_total" in extra:
        try:
            sn.total_likes = int(extra["likes_total"] or 0)
        except (TypeError, ValueError):
            pass
    sn.last_synced_at = timezone.now()
    sn.verified_via_api = True
    sn.token_status = "active"


def _upsert_videos(sn: SocialNetwork, videos):
    """Replace stored SocialVideo rows for `sn` with the freshly fetched list."""
    if videos is None:
        return
    seen_ids = []
    for v in videos:
        if not getattr(v, "external_video_id", ""):
            continue
        seen_ids.append(v.external_video_id)
        SocialVideo.objects.update_or_create(
            social_network=sn,
            external_video_id=v.external_video_id,
            defaults={
                "caption": (v.caption or "")[:500],
                "thumbnail_url": v.thumbnail_url or "",
                "video_url": v.video_url or "",
                "view_count": int(v.view_count or 0),
                "like_count": int(v.like_count or 0),
                "comment_count": int(v.comment_count or 0),
                "share_count": int(v.share_count or 0),
                "duration_sec": int(v.duration_sec or 0),
                "published_at": v.published_at,
            },
        )
    if seen_ids:
        sn.videos.exclude(external_video_id__in=seen_ids).delete()


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
                "oauth_url": f"https://oauth.influconnect.fr/{sn.platform}/start?sn={sn.id}",
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
        _upsert_videos(sn, (getattr(stats, "extra", {}) or {}).get("videos"))
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
        _upsert_videos(sn, (getattr(stats, "extra", {}) or {}).get("videos"))
        return Response(SocialNetworkSerializer(sn).data)


class SocialOAuthRevokeView(APIView):
    """Disconnect a social network: wipe stored OAuth tokens and reset verified flag."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            sn = SocialNetwork.objects.get(pk=pk, influencer__user=request.user)
        except SocialNetwork.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        sn.oauth_access_token = ""
        sn.oauth_refresh_token = ""
        sn.oauth_expires_at = None
        sn.verified_via_api = False
        sn.token_status = "revoked"
        sn.save(update_fields=[
            "oauth_access_token", "oauth_refresh_token",
            "oauth_expires_at", "verified_via_api", "token_status",
        ])
        return Response(SocialNetworkSerializer(sn).data)


# ---------------------------------------------------------------------------
# Social videos / snapshots / fraud flags (CDC §1, §9, §10)
# ---------------------------------------------------------------------------
def _social_network_visible_qs(request):
    """Return SocialNetwork queryset visible to the requesting user.

    Influencers see only their own; brands/admins see any. Anonymous users
    only see networks marked as verified via API (public consumption).
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return SocialNetwork.objects.filter(verified_via_api=True)
    if user.is_staff or user.user_type in ("brand", "admin"):
        return SocialNetwork.objects.all()
    if user.user_type == "influencer":
        return SocialNetwork.objects.filter(influencer__user=user) | SocialNetwork.objects.filter(verified_via_api=True)
    return SocialNetwork.objects.filter(verified_via_api=True)


class SocialVideoListView(generics.ListAPIView):
    serializer_class = SocialVideoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        sn = get_object_or_404(_social_network_visible_qs(self.request), pk=self.kwargs["pk"])
        limit = int(self.request.query_params.get("limit", 20) or 20)
        return sn.videos.order_by("-published_at", "-id")[: max(1, min(limit, 50))]


class SocialStatsSnapshotListView(generics.ListAPIView):
    serializer_class = SocialStatsSnapshotSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        sn = get_object_or_404(_social_network_visible_qs(self.request), pk=self.kwargs["pk"])
        days_param = (self.request.query_params.get("range") or "30").lower()
        try:
            days = int(days_param.rstrip("d"))
        except ValueError:
            days = 30
        days = max(1, min(days, 365))
        since = (timezone.now() - timedelta(days=days)).date()
        return sn.stats_snapshots.filter(snapshot_date__gte=since).order_by("snapshot_date")


class SocialFraudFlagListView(generics.ListAPIView):
    serializer_class = SocialFraudFlagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        sn = get_object_or_404(_social_network_visible_qs(self.request), pk=self.kwargs["pk"])
        return sn.fraud_flags.filter(resolved_at__isnull=True).order_by("-created_at")


class AdminFraudFlagListView(generics.ListAPIView):
    """Admin moderation: all unresolved fraud flags across the platform."""
    serializer_class = SocialFraudFlagSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = SocialFraudFlag.objects.select_related(
            "social_network", "social_network__influencer", "social_network__influencer__user"
        ).filter(resolved_at__isnull=True).order_by("-severity", "-created_at")
        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)
        return qs


class AdminFraudFlagResolveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        flag = get_object_or_404(SocialFraudFlag, pk=pk)
        if flag.resolved_at is None:
            flag.resolved_at = timezone.now()
            flag.save(update_fields=["resolved_at"])
        return Response(SocialFraudFlagSerializer(flag).data)


# ---------------------------------------------------------------------------
# Campaign video tracking (CDC §6 — performance dashboard)
# ---------------------------------------------------------------------------
import re as _re

_TIKTOK_VIDEO_RE = _re.compile(r"tiktok\.com/.*?/video/(\d+)")


def _extract_video_id(platform: str, url: str) -> str | None:
    if not url:
        return None
    if platform == "tiktok":
        m = _TIKTOK_VIDEO_RE.search(url)
        return m.group(1) if m else None
    return None


class CampaignVideoTrackingListView(APIView):
    """List or attach a tracked video to an accepted campaign proposal."""
    permission_classes = [IsAuthenticated]

    def _get_proposal(self, request, pk):
        proposal = get_object_or_404(CampaignProposal, pk=pk)
        user = request.user
        is_brand = user.user_type == "brand" and user_can_access_brand(user, proposal.campaign.brand)
        is_influencer = user.user_type == "influencer" and proposal.influencer.user_id == user.id
        is_admin = user.is_staff or user.user_type == "admin"
        if not (is_brand or is_influencer or is_admin):
            return None
        return proposal

    def get(self, request, pk):
        proposal = self._get_proposal(request, pk)
        if proposal is None:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        qs = proposal.tracked_videos.all().prefetch_related("daily_stats")
        return Response(CampaignVideoTrackingSerializer(qs, many=True).data)

    def post(self, request, pk):
        proposal = self._get_proposal(request, pk)
        if proposal is None:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if proposal.status != "accepted":
            return Response(
                {"detail": "Proposal must be accepted before tracking videos."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        platform = (request.data.get("platform") or "tiktok").lower()
        video_url = (request.data.get("video_url") or "").strip()
        video_id = _extract_video_id(platform, video_url)
        if not video_id:
            return Response(
                {"detail": "Could not extract video ID from URL."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sn = SocialNetwork.objects.filter(
            influencer=proposal.influencer, platform=platform,
        ).first()
        tracking, created = CampaignVideoTracking.objects.get_or_create(
            proposal=proposal,
            platform=platform,
            external_video_id=video_id,
            defaults={
                "social_network": sn,
                "video_url": video_url,
                "tracking_ends_at": timezone.now() + timedelta(
                    days=CampaignVideoTracking.TRACKING_WINDOW_DAYS,
                ),
            },
        )
        # First fetch right away if the influencer has a token.
        if created and sn and sn.oauth_access_token:
            try:
                from .services.social.base import TokenBundle
                provider = get_provider(platform)
                access_token = decrypt_token(sn.oauth_access_token) or ""
                refresh_token = decrypt_token(sn.oauth_refresh_token) or ""
                if access_token and provider is not None:
                    tokens = TokenBundle(access_token=access_token, refresh_token=refresh_token)
                    vs = provider.fetch_video_stats(tokens, video_id)
                    _record_video_stats(tracking, vs)
            except (ProviderError, NotImplementedError, Exception):
                pass
        return Response(
            CampaignVideoTrackingSerializer(tracking).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CampaignVideoTrackingDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        tracking = get_object_or_404(CampaignVideoTracking, pk=pk)
        proposal = tracking.proposal
        user = request.user
        is_brand = user.user_type == "brand" and user_can_access_brand(user, proposal.campaign.brand)
        is_influencer = user.user_type == "influencer" and proposal.influencer.user_id == user.id
        is_admin = user.is_staff or user.user_type == "admin"
        if not (is_brand or is_influencer or is_admin):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        tracking.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _record_video_stats(tracking: "CampaignVideoTracking", vs) -> None:
    """Update tracking row + upsert today's daily stats."""
    today = timezone.now().date()
    views = int(vs.view_count or 0)
    likes = int(vs.like_count or 0)
    comments = int(vs.comment_count or 0)
    shares = int(vs.share_count or 0)
    engagement = Decimal("0")
    if views > 0:
        engagement = Decimal(str(round((likes + comments + shares) / views * 100, 2)))
    if vs.caption and not tracking.caption:
        tracking.caption = vs.caption[:500]
    if vs.thumbnail_url and not tracking.thumbnail_url:
        tracking.thumbnail_url = vs.thumbnail_url
    tracking.last_fetched_at = timezone.now()
    tracking.last_error = ""
    tracking.save(update_fields=["caption", "thumbnail_url", "last_fetched_at", "last_error"])
    CampaignVideoDailyStats.objects.update_or_create(
        tracking=tracking,
        snapshot_date=today,
        defaults={
            "view_count": views,
            "like_count": likes,
            "comment_count": comments,
            "share_count": shares,
            "engagement_rate": engagement,
        },
    )



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
        from .views import _update_average_rating
        _update_average_rating(review.reviewee)
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
            try:
                acct = stripe_service.create_connected_account(email=request.user.email)
            except stripe_service.PaymentConfigurationError as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            except NotImplementedError:
                return Response({"detail": "Live Stripe Connect onboarding is not available yet."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
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
        candidates = InfluencerProfile.objects.filter(
            user__user_type="influencer",
            user__is_active=True,
            is_verified=True,
        ).select_related("user").prefetch_related("social_networks", "media_kit_images").order_by("-user__created_at", "-id")

        ugc = (self.request.query_params.get("ugc") or "").lower()
        if ugc in ("1", "true", "yes"):
            candidates = candidates.filter(is_ugc_creator=True)

        # Only list influencers a brand can actually evaluate.
        complete_ids = [p.id for p in candidates if is_marketplace_ready(p)]
        return candidates.filter(id__in=complete_ids)


class MarketplaceContactInfluencerView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.user_type != "brand":
            return Response({"detail": "Only brands can contact influencers."}, status=status.HTTP_403_FORBIDDEN)

        brand = resolve_active_brand(user, request=request)
        if brand is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)

        if brand.validation_status != "approved":
            return Response(
                {"detail": "Brand profile must be approved before contacting influencers."},
                status=status.HTTP_403_FORBIDDEN,
            )

        influencer_id = request.data.get("influencer_id")
        message = (request.data.get("message") or "").strip()
        if not influencer_id:
            return Response({"detail": "influencer_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(message) < 10:
            return Response({"detail": "Message must contain at least 10 characters."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            influencer = InfluencerProfile.objects.select_related("user").get(pk=influencer_id)
        except InfluencerProfile.DoesNotExist:
            return Response({"detail": "Influencer not found."}, status=status.HTTP_404_NOT_FOUND)

        sender_name = (brand.company_name or user.username).strip()

        # Create DirectMessage
        DirectMessage.objects.create(
            sender=user,
            recipient=influencer.user,
            content=message
        )
        _audit(user, "marketplace_contact", target_type="BrandProfile",
               target_id=brand.id, metadata={"influencer_id": influencer.id})
        
        _notify(
            influencer.user,
            "new_message",
            "Nouveau message marketplace",
            f"{sender_name} vous a contacté via la marketplace :\n\n{message}",
            send_email=bool(influencer.user.email),
            email_subject="InfluConnect — Nouveau contact marque",
            email_body=(
                f"Bonjour,\n\n"
                f"{sender_name} vous a contacté via la marketplace InfluConnect :\n\n"
                f"{message}\n\n"
                "Connectez-vous à InfluConnect pour répondre et proposer une collaboration."
            ),
        )
        _audit(
            user,
            "marketplace_contact_influencer",
            "InfluencerProfile",
            influencer.id,
            metadata={"brand_id": brand.id},
            ip=_client_ip(request),
        )

        return Response({"sent": True}, status=status.HTTP_201_CREATED)


class InfluencerReferralOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans_service.require_platform_feature("referral_program")
        if request.user.user_type != 'influencer':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return Response({'detail': 'Influencer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        _generate_referral_code_if_missing(profile)

        accepted_count = profile.referrals_made.count()
        pending_count = InfluencerReferralInvite.objects.filter(inviter=profile, status='sent').count()
        return Response({
            'referral_code': profile.referral_code,
            'discount_percent': profile.referral_commission_discount_percent,
            'referred_by': profile.referred_by_id,
            'accepted_referrals': accepted_count,
            'pending_invites': pending_count,
        })


class InfluencerReferralInviteListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        plans_service.require_platform_feature("referral_program")
        if request.user.user_type != 'influencer':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return Response({'detail': 'Influencer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        _generate_referral_code_if_missing(profile)

        invites = InfluencerReferralInvite.objects.filter(inviter=profile).order_by('-created_at')[:50]
        return Response({
            'results': [
                {
                    'id': inv.id,
                    'invited_email': inv.invited_email,
                    'status': inv.status,
                    'invitation_token': str(inv.invitation_token),
                    'referral_code_snapshot': inv.referral_code_snapshot,
                    'created_at': inv.created_at,
                    'accepted_at': inv.accepted_at,
                }
                for inv in invites
            ]
        })

    def post(self, request):
        plans_service.require_platform_feature("referral_program")
        if request.user.user_type != 'influencer':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return Response({'detail': 'Influencer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        _generate_referral_code_if_missing(profile)

        email = (request.data.get('invited_email') or '').strip().lower()
        if not email:
            return Response({'invited_email': 'required'}, status=status.HTTP_400_BAD_REQUEST)

        existing = InfluencerReferralInvite.objects.filter(
            inviter=profile,
            invited_email__iexact=email,
            status='sent',
        ).first()
        if existing:
            return Response({'detail': 'Invitation already sent.'}, status=status.HTTP_409_CONFLICT)

        invitation_message = (request.data.get('message') or '').strip()
        invite = InfluencerReferralInvite.objects.create(
            inviter=profile,
            invited_email=email,
            referral_code_snapshot=profile.referral_code,
            invitation_message=invitation_message,
        )

        frontend = getattr(settings, 'FRONTEND_URL', 'https://influconnect.fr').rstrip('/')
        register_url = f"{frontend}/register?type=influencer&ref={profile.referral_code}"
        sender_name = (profile.display_name or '').strip() or request.user.username
        language = request.user.language_preference
        is_fr = str(language or '').lower().startswith('fr')
        message_block = f"\n\nMessage personnel:\n{invitation_message}\n" if invitation_message else ""

        email_service.send(
            to=email,
            subject=(
                f"InfluConnect - {sender_name} vous invite" if is_fr
                else f"InfluConnect - {sender_name} invited you"
            ),
            body_text=(
                (
                    f"Bonjour,\n\n{sender_name} vous invite sur InfluConnect.\n"
                    f"Code de parrainage: {profile.referral_code}\n"
                    f"Inscription: {register_url}"
                    f"{message_block}\n"
                    "En rejoignant avec ce code, vous obtenez tous les deux une reduction de commission.\n"
                )
                if is_fr else
                (
                    f"Hello,\n\n{sender_name} invited you to InfluConnect.\n"
                    f"Referral code: {profile.referral_code}\n"
                    f"Register: {register_url}"
                    f"{message_block}\n"
                    "By joining with this code, both of you receive a commission discount.\n"
                )
            ),
        )

        return Response({
            'id': invite.id,
            'invited_email': invite.invited_email,
            'status': invite.status,
            'invitation_token': str(invite.invitation_token),
            'referral_code_snapshot': invite.referral_code_snapshot,
            'created_at': invite.created_at,
        }, status=status.HTTP_201_CREATED)

from ._views_team_agency import (
    BrandMembershipListCreateView, BrandMembershipDetailView,
    AgencyDelegationListCreateView, AgencyDelegationActionView,
    BrandEnvironmentListView, BrandEnvironmentSwitchView,
)

