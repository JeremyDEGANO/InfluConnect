from decimal import Decimal
import base64
import binascii
import logging
from django.db import models
from django.conf import settings as django_settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.core.files.base import ContentFile
from django.http import FileResponse, Http404
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q, Sum, Avg
from rest_framework import generics, status, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile, BrandMembership,
    Campaign, CampaignProposal, Event, EventInvitation, ContentSubmission,
    Message, DirectMessage, Review, Notification, PlatformSettings, AuditLog,
)
from .serializers import (
    UserSerializer, InfluencerProfileSerializer, InfluencerProfileWithPaymentSerializer,
    SocialNetworkSerializer, BrandProfileSerializer,
    CampaignSerializer, CampaignProposalSerializer, EventSerializer, EventInvitationSerializer, ContentSubmissionSerializer,
    MessageSerializer, DirectMessageSerializer, ReviewSerializer, NotificationSerializer, PlatformSettingsSerializer,
    RegisterSerializer, LoginSerializer, _abs_media_url,
)
from .throttling import LoginRateThrottle, RegisterRateThrottle
from .services import email_service, stripe_service
from .services import plans as plans_service
from .services.pdf_service import generate_contract_pdf
from .constants import CONTENT_THEMES
from .workspace import resolve_active_brand, get_user_role_for_brand, user_can_access_brand
from cryptography.fernet import Fernet, InvalidToken
import hashlib


logger = logging.getLogger(__name__)


def _message_fernet() -> Fernet:
    key = getattr(django_settings, 'FERNET_KEY', None)
    if not key:
        raw = b'influconnect-default-encryption-key-32b!'
        key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    elif isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def _encrypt_message_text(value: str) -> str:
    plain = (value or '').strip()
    if not plain:
        return ''
    token = _message_fernet().encrypt(plain.encode('utf-8')).decode('utf-8')
    return f'enc:v1:{token}'


def _decrypt_message_text(value: str) -> str:
    raw = value or ''
    if not raw.startswith('enc:v1:'):
        return raw
    token = raw[len('enc:v1:'):]
    try:
        return _message_fernet().decrypt(token.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError):
        return ''


def _shift_month_start(value, months_back):
    month_index = value.month - months_back - 1
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(
        year=year,
        month=month,
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )


_THEME_ALIAS_TO_CODE = {}
for _theme in CONTENT_THEMES:
    _code = str(_theme.get("code", "")).strip()
    _label = str(_theme.get("label", "")).strip()
    if _code:
        _THEME_ALIAS_TO_CODE[_code.casefold()] = _code
    if _label:
        _THEME_ALIAS_TO_CODE[_label.casefold()] = _code


def _theme_candidates(value):
    """Return compatible theme values for legacy/code/label matching."""
    raw = str(value or "").strip()
    if not raw:
        return []
    code = _THEME_ALIAS_TO_CODE.get(raw.casefold(), raw.casefold())
    candidates = {code, raw, raw.casefold(), raw.lower()}
    return [c for c in candidates if c]


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit(actor, action, target_type="", target_id=None, metadata=None, ip=None):
    AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action, target_type=target_type, target_id=target_id,
        metadata=metadata or {}, ip_address=ip,
    )


def create_notification(user, notification_type, title, message, proposal=None):
    Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        related_proposal=proposal,
    )


def _notif_text(user, fr: str, en: str) -> str:
    lang = str(getattr(user, "language_preference", "") or "").lower()
    return fr if lang.startswith("fr") else en


def _conversation_display_name(user):
    if getattr(user, "user_type", "") == "influencer":
        try:
            pseudo = (user.influencer_profile.display_name or "").strip()
        except InfluencerProfile.DoesNotExist:
            pseudo = ""
        return pseudo or user.username
    if getattr(user, "user_type", "") == "brand":
        try:
            company = (user.brand_profile.company_name or "").strip()
        except BrandProfile.DoesNotExist:
            company = ""
        return company or user.username
    return user.username


SIGN_SESSION_TTL_SECONDS = 60 * 60


def _sign_session_signer() -> TimestampSigner:
    return TimestampSigner(salt="proposal-sign-session")


def _encode_url_token(raw: str) -> str:
    encoded = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def _decode_url_token(token: str):
    # Restore removed padding for URL-safe base64 decode.
    pad = "=" * ((4 - len(token) % 4) % 4)
    try:
        decoded = base64.urlsafe_b64decode((token + pad).encode("ascii"))
        return decoded.decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return None


def _build_sign_session_token(proposal_id: int, user_id: int) -> str:
    raw = _sign_session_signer().sign(f"{proposal_id}:{user_id}")
    return _encode_url_token(raw)


def _decode_sign_session_token(token: str):
    raw = _decode_url_token(token)
    if not raw:
        return None, None
    try:
        unsigned = _sign_session_signer().unsign(raw, max_age=SIGN_SESSION_TTL_SECONDS)
    except (SignatureExpired, BadSignature):
        return None, None
    try:
        proposal_id_str, user_id_str = str(unsigned).split(":", 1)
        return int(proposal_id_str), int(user_id_str)
    except (TypeError, ValueError):
        return None, None


def _session_used_for_signer(proposal, signer):
    if signer.user_type == "brand":
        return bool(proposal.brand_signed_at)
    if signer.user_type == "influencer":
        return bool(proposal.influencer_signed_at)
    return True


def _session_completed_at_for_signer(proposal, signer):
    if signer.user_type == "brand" and proposal.brand_signed_at:
        return proposal.brand_signed_at.isoformat()
    if signer.user_type == "influencer" and proposal.influencer_signed_at:
        return proposal.influencer_signed_at.isoformat()
    return None


def _refresh_signed_contract_pdf(proposal):
    """Regenerate the visible contract PDF from the saved signature state."""
    proposal.refresh_from_db()
    pdf_bytes = generate_contract_pdf(proposal=proposal)
    filename = (
        f"contract_prop_{proposal.id}_v{proposal.contract_version}_"
        f"signed_{timezone.now():%Y%m%d_%H%M%S_%f}.pdf"
    )
    proposal.contract_pdf.save(filename, ContentFile(pdf_bytes), save=False)
    proposal.save(update_fields=["contract_pdf", "updated_at"])


def _extract_signature_payload(request_data, signer_user, proposal):
    mode = str(request_data.get("signature_mode") or "").strip()
    value = str(request_data.get("signature_value") or "").strip()
    data = request_data.get("signature_data") or ""

    if signer_user.user_type == "brand":
        default_value = proposal.campaign.brand.company_name
    else:
        default_value = proposal.influencer.display_name or signer_user.get_full_name() or signer_user.username

    if mode == "brand_name" and not value:
        value = default_value
    elif mode == "person_name" and not value:
        value = signer_user.get_full_name().strip() or getattr(proposal.influencer, "display_name", "") or signer_user.username

    return {
        "mode": mode,
        "value": value,
        "data": str(data or ""),
    }


def _sign_proposal(proposal, signer_user, ip=None, signature_payload=None):
    """Apply signature business rules for either brand or influencer signer."""
    is_brand = (
        signer_user.user_type == "brand"
        and get_user_role_for_brand(signer_user, proposal.campaign.brand) in ("owner", "admin")
    )
    is_influencer = (
        signer_user.user_type == "influencer"
        and hasattr(signer_user, "influencer_profile")
        and proposal.influencer == signer_user.influencer_profile
    )

    if not is_brand and not is_influencer:
        return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

    brand_just_signed = False

    if is_brand:
        if proposal.brand_signed_at:
            return Response({"detail": "Brand has already signed."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.contract_signed_brand = True
        brand_just_signed = True

    if is_influencer:
        if not proposal.brand_signed_at:
            return Response({"detail": "Brand must sign first."}, status=status.HTTP_400_BAD_REQUEST)
        if proposal.influencer_signed_at:
            return Response({"detail": "Influencer has already signed."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.contract_signed_influencer = True

    now = timezone.now()
    if is_brand and not proposal.brand_signed_at:
        proposal.brand_signed_at = now
        proposal.brand_signature_ip = ip
        proposal.brand_signature_mode = (signature_payload or {}).get("mode", "")
        proposal.brand_signature_value = (signature_payload or {}).get("value", "")
        proposal.brand_signature_data = (signature_payload or {}).get("data", "")
    if is_influencer and not proposal.influencer_signed_at:
        proposal.influencer_signed_at = now
        proposal.influencer_signature_ip = ip
        proposal.influencer_signature_mode = (signature_payload or {}).get("mode", "")
        proposal.influencer_signature_value = (signature_payload or {}).get("value", "")
        proposal.influencer_signature_data = (signature_payload or {}).get("data", "")

    if proposal.contract_signed_brand and proposal.contract_signed_influencer:
        proposal.status = "contract_signed"
        proposal.contract_signed_at = now
        _audit(signer_user, "contract_signed", "CampaignProposal", proposal.id, ip=ip)
        for recipient in (proposal.influencer.user, *_brand_users(proposal.campaign.brand)):
            create_notification(
                user=recipient,
                notification_type="contract_signed",
                title=_notif_text(recipient, "Contrat signe par les deux parties", "Contract fully signed"),
                message=_notif_text(
                    recipient,
                    f'Le contrat pour "{proposal.campaign.title}" a ete signe par les deux parties.',
                    f'The contract for "{proposal.campaign.title}" has been signed by both parties.',
                ),
                proposal=proposal,
            )
    elif brand_just_signed:
        _audit(signer_user, "contract_signed_brand", "CampaignProposal", proposal.id, ip=ip)
        create_notification(
            user=proposal.influencer.user,
            notification_type="contract_ready",
            title="Contrat signé par la marque",
            message=(
                f'La marque a signé le contrat pour « {proposal.campaign.title} ». '
                "Veuillez le relire et le signer à votre tour."
            ),
            proposal=proposal,
        )
        if proposal.influencer.user.email:
            email_service.send_contract_ready_for_signature(
                proposal.influencer.user.email,
                "influencer",
                proposal.campaign.title,
                language=proposal.influencer.user.language_preference,
            )

    proposal.save()
    try:
        _refresh_signed_contract_pdf(proposal)
    except Exception as exc:  # noqa: BLE001
        logger.exception("signed-contract PDF refresh failed for proposal %s: %s", proposal.id, exc)
        return Response(
            {"detail": "Signature saved, but signed contract PDF refresh failed."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if proposal.contract_signed_brand and proposal.contract_signed_influencer:
        pdf_url = _abs_media_url(None, proposal.contract_pdf)
        if proposal.influencer.user.email:
            email_service.send_contract_signed_both(
                proposal.influencer.user.email,
                proposal.campaign.title,
                pdf_url=pdf_url,
                language=proposal.influencer.user.language_preference,
            )
        brand_contact = _brand_primary_user(proposal.campaign.brand)
        if brand_contact and brand_contact.email:
            email_service.send_contract_signed_both(
                brand_contact.email,
                proposal.campaign.title,
                pdf_url=pdf_url,
                language=brand_contact.language_preference,
            )
    return None


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def _update_average_rating(user):
    avg = Review.objects.filter(reviewee=user).aggregate(avg=Avg("rating"))["avg"] or 0
    avg = round(float(avg), 2)
    if user.user_type == "influencer" and hasattr(user, "influencer_profile"):
        user.influencer_profile.average_rating = avg
        user.influencer_profile.save(update_fields=["average_rating"])
    elif user.user_type == "brand" and hasattr(user, "brand_profile"):
        user.brand_profile.average_rating = avg
        user.brand_profile.save(update_fields=["average_rating"])


def _active_brand(request):
    return resolve_active_brand(request.user, request=request)


def _brand_users(brand):
    """Active users behind a brand workspace (the profile owner may be an
    inactive stub for secondary environments — fall back to team members)."""
    from .models import OrganizationMembership
    users = []
    seen = set()

    def _add(u):
        if u and u.is_active and u.id not in seen:
            seen.add(u.id)
            users.append(u)

    _add(brand.user)
    for m in BrandMembership.objects.filter(
        brand=brand, status="active", user__isnull=False, user__is_active=True,
    ).select_related("user"):
        _add(m.user)
    if brand.organization_id:
        for om in OrganizationMembership.objects.filter(
            organization_id=brand.organization_id, status="active", user__is_active=True,
        ).select_related("user"):
            _add(om.user)
    return users


def _brand_primary_user(brand):
    """Best single contact for emails about this workspace."""
    users = _brand_users(brand)
    return users[0] if users else brand.user


def _effective_commission_rate_for_proposal(proposal: CampaignProposal, base_rate: Decimal) -> Decimal:
    discount = Decimal(str(getattr(proposal.influencer, 'referral_commission_discount_percent', 0) or 0))
    effective = base_rate - discount
    if effective < Decimal('0'):
        return Decimal('0')
    return effective


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            # CDC §5.1 — brand registration kicks off the validation workflow
            if user.user_type == "brand":
                profile = user.brand_profile
                email_service.send_brand_registration_received(
                    user.email,
                    profile.company_name,
                    language=user.language_preference,
                )
                admin_emails = list(getattr(django_settings, "ADMIN_NOTIFICATION_EMAILS", []) or [])
                if not admin_emails:
                    admin_emails = list(
                        User.objects.filter(user_type="admin").values_list("email", flat=True)
                    )
                if admin_emails:
                    email_service.send_admin_new_brand_to_validate(
                        admin_emails, profile.company_name, profile.id,
                    )
            return Response(
                {"user": UserSerializer(user, context={"request": request}).data, **tokens},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data["user"]
            # 2FA gate: if enabled, require a valid TOTP code in the same request
            if user.totp_enabled:
                from .views_auth import verify_user_totp
                code = (request.data.get("totp_code") or "").strip()
                if not code:
                    return Response(
                        {"totp_required": True},
                        status=status.HTTP_200_OK,
                    )
                if not verify_user_totp(user, code):
                    return Response(
                        {"totp_required": True, "detail": "Invalid verification code."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif user.email_2fa_enabled:
                from .views_auth import issue_user_email_login_code, verify_user_email_login_code
                email_code = (request.data.get("email_otp_code") or "").strip()
                if not email_code:
                    issue_user_email_login_code(user)
                    return Response(
                        {"email_otp_required": True, "email_otp_sent": True},
                        status=status.HTTP_200_OK,
                    )
                if not verify_user_email_login_code(user, email_code):
                    return Response(
                        {"email_otp_required": True, "detail": "Invalid or expired email code."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            if user.user_type == 'brand':
                resolve_active_brand(user, request=request)
            tokens = get_tokens_for_user(user)
            return Response({"user": UserSerializer(user, context={"request": request}).data, **tokens})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type == 'brand':
            resolve_active_brand(request.user, request=request)
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        user = request.user
        user_data = {k: v for k, v in request.data.items()
                     if k not in ("influencer_profile", "brand_profile")}
        # Remap uploaded 'avatar' file to 'avatar_upload' (the writable serializer field).
        if "avatar" in request.FILES:
            user_data["avatar_upload"] = request.FILES["avatar"]
        user_serializer = UserSerializer(user, data=user_data, partial=True)
        if not user_serializer.is_valid():
            return Response(user_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user_serializer.save()

        if user.user_type == "influencer" and hasattr(user, "influencer_profile"):
            profile_data = request.data.get("influencer_profile", {})
            if profile_data:
                ps = InfluencerProfileWithPaymentSerializer(
                    user.influencer_profile, data=profile_data, partial=True
                )
                if not ps.is_valid():
                    return Response(ps.errors, status=status.HTTP_400_BAD_REQUEST)
                ps.save()
        elif user.user_type == "brand" and hasattr(user, "brand_profile"):
            profile_data = request.data.get("brand_profile", {})
            if profile_data:
                ps = BrandProfileSerializer(user.brand_profile, data=profile_data, partial=True)
                if not ps.is_valid():
                    return Response(ps.errors, status=status.HTTP_400_BAD_REQUEST)
                ps.save()

        return Response(UserSerializer(user, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Influencer views
# ---------------------------------------------------------------------------

class InfluencerListView(generics.ListAPIView):
    serializer_class = InfluencerProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
        if self.request.user.user_type == "brand":
            qs = qs.filter(onboarding_completed=True)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                models.Q(display_name__icontains=search)
                | models.Q(user__username__icontains=search)
                | models.Q(user__first_name__icontains=search)
                | models.Q(user__last_name__icontains=search)
            )

        platform = self.request.query_params.get("platform")
        if platform:
            qs = qs.filter(social_networks__platform=platform)

        min_followers = self.request.query_params.get("min_followers")
        if min_followers:
            try:
                qs = qs.filter(social_networks__followers_count__gte=int(min_followers))
            except ValueError:
                pass

        content_themes = self.request.query_params.get("content_themes")
        if content_themes:
            for theme in content_themes.split(","):
                cleaned = theme.strip()
                if cleaned:
                    qs = qs.filter(content_themes__contains=[cleaned])

        min_rating = self.request.query_params.get("min_rating")
        if min_rating:
            try:
                qs = qs.filter(average_rating__gte=float(min_rating))
            except ValueError:
                pass

        location = self.request.query_params.get("location")
        if location:
            qs = qs.filter(user__location__icontains=location)

        return qs.distinct()


class InfluencerDetailView(generics.RetrieveAPIView):
    queryset = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
    serializer_class = InfluencerProfileSerializer
    permission_classes = [IsAuthenticated]


class InfluencerDetailByPseudoView(generics.RetrieveAPIView):
    queryset = InfluencerProfile.objects.select_related("user").prefetch_related("social_networks")
    serializer_class = InfluencerProfileSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "pseudo"

    def get_object(self):
        pseudo = (self.kwargs.get(self.lookup_url_kwarg) or "").strip()
        queryset = self.get_queryset()

        profile = queryset.filter(display_name__iexact=pseudo).first()
        if profile:
            return profile

        profile = queryset.filter(user__username__iexact=pseudo).first()
        if profile:
            return profile

        raise Http404("No InfluencerProfile matches the given query.")

class InfluencerProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, request):
        if request.user.user_type != "influencer":
            return None
        try:
            return request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return None

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        profile = self._get_profile(request)
        if profile is None:
            return Response({"detail": "Influencer profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = InfluencerProfileWithPaymentSerializer(profile, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InfluencerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "influencer":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        try:
            profile = request.user.influencer_profile
        except InfluencerProfile.DoesNotExist:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        proposals = CampaignProposal.objects.filter(influencer=profile)
        total_earnings = proposals.filter(status="paid").aggregate(
            total=Sum("escrow_amount")
        )["total"] or 0

        # Monthly timeseries (last 6 months) — new proposals, earnings
        now = timezone.now()
        months = []
        for i in range(5, -1, -1):
            month_start = _shift_month_start(now.replace(day=1), i)
            next_month = _shift_month_start(now.replace(day=1), i - 1)
            label = month_start.strftime("%b %Y")
            prop_count = proposals.filter(
                created_at__gte=month_start, created_at__lt=next_month
            ).count()
            earnings = proposals.filter(
                status="paid",
                escrow_released_at__gte=month_start, escrow_released_at__lt=next_month,
            ).aggregate(total=Sum("escrow_amount"))["total"] or 0
            months.append({
                "label": label,
                "proposals": prop_count,
                "earnings": float(earnings),
            })

        return Response({
            "total_proposals": proposals.count(),
            "pending_proposals": proposals.filter(status="pending").count(),
            "active_proposals": proposals.filter(
                status__in=["accepted", "contract_signed", "in_progress", "content_submitted"]
            ).count(),
            "total_earnings": float(total_earnings),
            "timeseries": months,
            "recent_proposals": CampaignProposalSerializer(
                proposals.order_by("-created_at")[:5], many=True
            ).data,
        })


class SocialNetworkViewSet(viewsets.ModelViewSet):
    serializer_class = SocialNetworkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.user_type != "influencer":
            return SocialNetwork.objects.none()
        try:
            return self.request.user.influencer_profile.social_networks.all()
        except InfluencerProfile.DoesNotExist:
            return SocialNetwork.objects.none()

    def perform_create(self, serializer):
        if self.request.user.user_type != "influencer":
            raise PermissionDenied("Only influencers can manage social networks.")
        profile = self.request.user.influencer_profile
        platform = serializer.validated_data.get("platform")
        if not platform:
            serializer.save(influencer=profile)
            return
        existing = SocialNetwork.objects.filter(influencer=profile, platform=platform).first()
        if existing:
            serializer.instance = existing
            serializer.save(influencer=profile)
            return
        serializer.save(influencer=profile)

    def perform_update(self, serializer):
        if self.request.user.user_type != "influencer":
            raise PermissionDenied("Only influencers can manage social networks.")
        profile = self.request.user.influencer_profile
        platform = serializer.validated_data.get("platform", getattr(serializer.instance, "platform", None))
        if platform:
            duplicate = SocialNetwork.objects.filter(influencer=profile, platform=platform).exclude(pk=serializer.instance.pk).first()
            if duplicate:
                serializer.instance = duplicate
                serializer.save(influencer=profile)
                return
        serializer.save(influencer=profile)


# ---------------------------------------------------------------------------
# Brand views
# ---------------------------------------------------------------------------

class BrandDetailView(generics.RetrieveAPIView):
    queryset = BrandProfile.objects.select_related("user")
    serializer_class = BrandProfileSerializer
    permission_classes = [IsAuthenticated]


class BrandProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, request):
        if request.user.user_type != "brand":
            return None
        return _active_brand(request)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial):
        profile = self._get_profile(request)
        if profile is None:
            return Response({"detail": "Brand profile not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = BrandProfileSerializer(profile, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BrandSubscribeView(APIView):
    """Legacy endpoint — activated a paid plan without going through billing.
    Kept only to return 410 for old clients; use /brands/subscription/change/."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        return Response(
            {"detail": "Deprecated. Use /api/brands/subscription/change/ instead."},
            status=status.HTTP_410_GONE,
        )


class BrandDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        profile = _active_brand(request)
        if not profile:
            return Response({"detail": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)

        campaigns = Campaign.objects.filter(brand=profile)
        proposals = CampaignProposal.objects.filter(campaign__brand=profile)
        total_spent = proposals.filter(status="paid").aggregate(
            total=Sum("escrow_amount")
        )["total"] or 0

        # Monthly timeseries (last 6 months) — campaigns created, spend
        now = timezone.now()
        months = []
        for i in range(5, -1, -1):
            month_start = _shift_month_start(now.replace(day=1), i)
            next_month = _shift_month_start(now.replace(day=1), i - 1)
            label = month_start.strftime("%b %Y")
            camp_count = campaigns.filter(
                created_at__gte=month_start, created_at__lt=next_month
            ).count()
            spend = proposals.filter(
                status="paid",
                escrow_funded_at__gte=month_start, escrow_funded_at__lt=next_month,
            ).aggregate(total=Sum("escrow_amount"))["total"] or 0
            prop_count = proposals.filter(
                created_at__gte=month_start, created_at__lt=next_month,
            ).count()
            months.append({
                "label": label,
                "campaigns": camp_count,
                "spend": float(spend),
                "proposals": prop_count,
            })

        status_breakdown = {}
        for s in ["pending", "accepted", "declined", "counter_offer", "contract_signed",
                  "in_progress", "content_submitted", "validated", "paid", "disputed"]:
            status_breakdown[s] = proposals.filter(status=s).count()

        # --- Actionable items: what the brand should deal with right now ----
        action_required = {
            "counter_offers": proposals.filter(status="counter_offer").count(),
            "contents_to_validate": proposals.filter(status="content_submitted").count(),
            "contracts_to_sign": proposals.filter(
                status="accepted", contract_signed_brand=False,
            ).exclude(contract_pdf="").exclude(contract_pdf__isnull=True).count(),
            "escrows_to_fund": proposals.filter(
                status="contract_signed", escrow_funded=False,
            ).count(),
        }

        unread_messages = Message.objects.filter(
            proposal__campaign__brand=profile, read=False,
        ).exclude(sender=request.user).count()

        recent_proposals = [
            {
                "id": p.id,
                "campaign_id": p.campaign_id,
                "campaign_title": p.campaign.title,
                "influencer_name": p.influencer.display_name or p.influencer.user.username,
                "status": p.status,
                "proposed_price": float(p.proposed_price or 0),
                "updated_at": p.updated_at,
            }
            for p in proposals.select_related("campaign", "influencer__user").order_by("-updated_at")[:6]
        ]

        today = timezone.now().date()
        upcoming_deadlines = [
            {
                "id": c.id,
                "title": c.title,
                "deadline": c.deadline,
                "days_left": (c.deadline - today).days,
                "status": c.status,
            }
            for c in campaigns.filter(
                status__in=["active", "paused"],
                deadline__isnull=False,
                deadline__gte=today,
                deadline__lte=today + timedelta(days=30),
            ).order_by("deadline")[:5]
        ]

        payload = {
            "total_campaigns": campaigns.count(),
            "active_campaigns": campaigns.filter(status="active").count(),
            "total_proposals_received": proposals.count(),
            "total_spent": float(total_spent),
            "in_progress_collabs": proposals.filter(
                status__in=["contract_signed", "in_progress", "content_submitted"],
            ).count(),
            "timeseries": months,
            "status_breakdown": status_breakdown,
            "action_required": action_required,
            "unread_messages": unread_messages,
            "recent_proposals": recent_proposals,
            "upcoming_deadlines": upcoming_deadlines,
        }

        if profile.is_agency:
            from .models import AgencyDelegation
            delegations = AgencyDelegation.objects.filter(agency=profile)
            payload["agency"] = {
                "active_delegations": delegations.filter(status="accepted").count(),
                "pending_delegations": delegations.filter(status="pending").count(),
            }

        return Response(payload)


# ---------------------------------------------------------------------------
# Campaign views
# ---------------------------------------------------------------------------

class CampaignViewSet(viewsets.ModelViewSet):
    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # The serializer exposes brand_name/brand_logo on every row
        qs = Campaign.objects.select_related("brand")
        if user.user_type == "brand":
            brand = _active_brand(self.request)
            if not brand:
                return Campaign.objects.none()
            return qs.filter(brand=brand).order_by("-created_at")
        elif user.user_type == "influencer":
            return qs.filter(status="active").order_by("-created_at")
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            raise PermissionDenied("Only brands can create campaigns.")
        brand = _active_brand(self.request)
        if not brand:
            raise PermissionDenied("Brand profile not found.")
        role = get_user_role_for_brand(self.request.user, brand)
        if role not in ('owner', 'admin'):
            raise PermissionDenied("Only workspace owners/admins can create campaigns.")
        if brand.is_agency:
            raise PermissionDenied(
                "Agency profiles cannot create campaigns. Agencies can manage influencers and contracts instead."
            )
        if brand.validation_status != "approved":
            raise PermissionDenied(
                "Your brand account must be approved by the InfluConnect team before creating campaigns."
            )
        # Plan entitlements: active campaign quota + open castings
        plans_service.enforce_limit(
            brand, "concurrent_campaigns",
            Campaign.objects.filter(brand=brand).exclude(status__in=["completed", "cancelled"]).count(),
        )
        if serializer.validated_data.get("is_casting"):
            plans_service.require_feature(brand, "open_castings")
        serializer.save(brand=brand)

    def perform_destroy(self, instance):
        active_brand = _active_brand(self.request)
        role = get_user_role_for_brand(self.request.user, instance.brand)
        if not self.request.user.is_staff and (not active_brand or active_brand.id != instance.brand_id or role not in ('owner', 'admin')):
            raise PermissionDenied("You do not own this campaign.")
        # Allow deletion unless there are proposals with signed contracts / in progress / paid
        blocking_statuses = ["contract_signed", "in_progress", "content_submitted", "validated", "paid"]
        blocking = instance.proposals.filter(
            status__in=["contract_signed", "in_progress", "content_submitted", "validated", "paid"]
        ).exists()
        if blocking:
            raise ValidationError({
                "detail": "Cannot delete a campaign with active or completed contracts.",
                "code": "campaign_has_active_contracts",
                "blocking_statuses": blocking_statuses,
            })
        instance.delete()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        active_brand = _active_brand(request)
        role = get_user_role_for_brand(request.user, instance.brand)
        if not request.user.is_staff and (not active_brand or active_brand.id != instance.brand_id or role not in ('owner', 'admin')):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)


class CampaignTargetView(APIView):
    permission_classes = [IsAuthenticated]

    def _filter(self, campaign, extra_filters=None):
        """Return matching influencer profiles based on campaign criteria."""
        filters = {**(campaign.target_filters or {}), **(extra_filters or {})}
        qs = InfluencerProfile.objects.prefetch_related("social_networks")

        # Support both a single "platform" key in target_filters and the campaign's target_networks list
        platforms = []
        platform = filters.get("platform")
        if platform:
            platforms = [platform]
        elif campaign.target_networks:
            platforms = list(campaign.target_networks)
        if platforms:
            norm = ["twitter" if str(p).strip().lower() == "x" else str(p).strip().lower() for p in platforms]
            qs = qs.filter(social_networks__platform__in=norm)

        min_followers = filters.get("min_followers")
        if min_followers:
            qs = qs.filter(social_networks__followers_count__gte=int(min_followers))

        content_themes = filters.get("content_themes") or filters.get("themes")
        if content_themes:
            from django.db.models import Q
            theme_q = Q()
            for theme in content_themes:
                for candidate in _theme_candidates(theme):
                    theme_q |= Q(content_themes__contains=[candidate])
            qs = qs.filter(theme_q)

        min_rating = filters.get("min_rating")
        if min_rating:
            qs = qs.filter(average_rating__gte=float(min_rating))

        location = filters.get("location")
        if location:
            qs = qs.filter(user__location__icontains=location)

        return qs.distinct()

    def get(self, request, pk):
        """GET — auto-match influencers based on campaign's own criteria."""
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        brand = _active_brand(request)
        if not brand:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            campaign = Campaign.objects.get(pk=pk, brand=brand)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        qs = self._filter(campaign)
        return Response(InfluencerProfileSerializer(qs, many=True, context={"request": request}).data)

    def post(self, request, pk):
        """POST — filter with custom overrides."""
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        brand = _active_brand(request)
        if not brand:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            campaign = Campaign.objects.get(pk=pk, brand=brand)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        qs = self._filter(campaign, request.data.get("filters"))
        return Response(InfluencerProfileSerializer(qs, many=True, context={"request": request}).data)


class CampaignSendProposalsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        brand = _active_brand(request)
        if not brand:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            campaign = Campaign.objects.get(pk=pk, brand=brand)
        except Campaign.DoesNotExist:
            return Response({"detail": "Campaign not found."}, status=status.HTTP_404_NOT_FOUND)

        influencer_ids = request.data.get("influencer_ids", [])
        proposed_price = request.data.get("proposed_price", campaign.price_per_influencer or 0)
        plans_service.enforce_monthly_contacts(brand, requested=len(influencer_ids))
        created = []
        skipped = []

        for inf_id in influencer_ids:
            try:
                influencer = InfluencerProfile.objects.get(pk=inf_id)
            except InfluencerProfile.DoesNotExist:
                skipped.append(inf_id)
                continue

            # Check if a proposal already exists for this campaign & influencer
            existing = CampaignProposal.objects.filter(campaign=campaign, influencer=influencer).first()
            if existing:
                # If it exists and is accepted or signed, skip
                if existing.status in ["accepted", "contract_signed"]:
                    skipped.append(inf_id)
                    continue
                # If it's in pending/declined state, skip to avoid duplicates
                skipped.append(inf_id)
                continue

            proposal = CampaignProposal.objects.create(
                campaign=campaign,
                influencer=influencer,
                proposed_price=proposed_price,
                contract_template=campaign.contract_template,
            )
            create_notification(
                user=influencer.user,
                notification_type="new_proposal",
                title=_notif_text(influencer.user, f"Nouvelle proposition : {campaign.title}", f"New proposal: {campaign.title}"),
                message=_notif_text(
                    influencer.user,
                    f'{campaign.brand.company_name} vous a envoye une proposition pour "{campaign.title}".',
                    f'{campaign.brand.company_name} sent you a proposal for "{campaign.title}".',
                ),
                proposal=proposal,
            )
            if influencer.user.email:
                email_service.send_proposal_received(
                    influencer.user.email,
                    campaign.title,
                    language=influencer.user.language_preference,
                )
            created.append(proposal.id)

        return Response({"created": created, "skipped": skipped}, status=status.HTTP_201_CREATED)


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.user_type == "brand":
            brand = _active_brand(self.request)
            if not brand:
                return Event.objects.none()
            return Event.objects.filter(brand=brand).prefetch_related('invitations__influencer__user', 'invitations__checked_in_by').order_by('-starts_at')
        if user.user_type == "influencer":
            try:
                influencer = user.influencer_profile
            except InfluencerProfile.DoesNotExist:
                return Event.objects.none()
            return Event.objects.filter(invitations__influencer=influencer).distinct().order_by('-starts_at')
        return Event.objects.none()

    def perform_create(self, serializer):
        if self.request.user.user_type != "brand":
            raise PermissionDenied("Only brands can create events.")
        brand = _active_brand(self.request)
        if not brand:
            raise PermissionDenied("Brand profile not found.")
        if brand.validation_status != "approved":
            raise PermissionDenied("Your brand account must be approved before creating events.")
        plans_service.require_feature(brand, "events")
        serializer.save(brand=brand)

    def perform_destroy(self, instance):
        if instance.brand.user != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You do not own this event.")
        instance.delete()


class EventInviteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.user_type != "brand":
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        brand = _active_brand(request)
        if not brand:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)
        try:
            event = Event.objects.get(pk=pk, brand=brand)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        influencer_ids = request.data.get("influencer_ids", []) or []
        invited_emails = request.data.get("invited_emails", []) or []
        max_plus_ones = int(request.data.get("max_plus_ones", 0) or 0)
        max_plus_ones = max(0, min(max_plus_ones, 2))
        created_ids = []
        skipped_ids = []
        external_created = []
        external_skipped = []

        for inf_id in influencer_ids:
            try:
                influencer = InfluencerProfile.objects.select_related('user').get(pk=inf_id)
            except InfluencerProfile.DoesNotExist:
                skipped_ids.append(inf_id)
                continue

            invitation, created = EventInvitation.objects.get_or_create(
                event=event,
                influencer=influencer,
                defaults={"max_plus_ones": max_plus_ones},
            )
            if not created:
                invitation.max_plus_ones = max_plus_ones
                invitation.status = 'pending'
                invitation.plus_ones_confirmed = 0
                invitation.response_message = ''
                invitation.responded_at = None
                invitation.save(update_fields=['max_plus_ones', 'status', 'plus_ones_confirmed', 'response_message', 'responded_at', 'updated_at'])

            created_ids.append(influencer.id)

            if influencer.user.email:
                frontend_url = getattr(django_settings, 'FRONTEND_URL', '').rstrip('/')
                rsvp_url = f"{frontend_url}/events/rsvp/{invitation.invite_token}"
                email_service.send_event_invitation(
                    influencer_email=influencer.user.email,
                    event_title=event.title,
                    event_address=event.address,
                    starts_at_label=timezone.localtime(event.starts_at).strftime('%d/%m/%Y %H:%M'),
                    rsvp_url=rsvp_url,
                    max_plus_ones=max_plus_ones,
                    language=influencer.user.language_preference,
                )

        for raw_email in invited_emails:
            email = str(raw_email or '').strip().lower()
            if not email:
                continue
            invitation, created = EventInvitation.objects.get_or_create(
                event=event,
                invited_email=email,
                defaults={
                    'max_plus_ones': max_plus_ones,
                    'influencer': None,
                },
            )
            if not created:
                external_skipped.append(email)
                continue

            external_created.append(email)
            frontend_url = getattr(django_settings, 'FRONTEND_URL', '').rstrip('/')
            rsvp_url = f"{frontend_url}/events/rsvp/{invitation.invite_token}"
            email_service.send_event_invitation(
                influencer_email=email,
                event_title=event.title,
                event_address=event.address,
                starts_at_label=timezone.localtime(event.starts_at).strftime('%d/%m/%Y %H:%M'),
                rsvp_url=rsvp_url,
                max_plus_ones=max_plus_ones,
            )

        return Response({
            "created": created_ids,
            "skipped": skipped_ids,
            "external_created": external_created,
            "external_skipped": external_skipped,
        }, status=status.HTTP_201_CREATED)


class EventInvitationListView(generics.ListAPIView):
    serializer_class = EventInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        token = (self.request.query_params.get('invitation') or '').strip()
        if user.user_type == 'influencer':
            try:
                influencer = user.influencer_profile
            except InfluencerProfile.DoesNotExist:
                return EventInvitation.objects.none()
            qs = EventInvitation.objects.filter(influencer=influencer).select_related('event', 'event__brand__user', 'influencer__user')
            if token:
                qs = qs.filter(invite_token=token)
            return qs.order_by('-created_at')
        if user.user_type == 'brand':
            brand = _active_brand(self.request)
            if not brand:
                return EventInvitation.objects.none()
            return EventInvitation.objects.filter(event__brand=brand).select_related('event', 'influencer__user', 'checked_in_by').order_by('-created_at')
        return EventInvitation.objects.none()


class EventInvitationRespondView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = (request.data.get('invitation_token') or '').strip()
        status_value = (request.data.get('status') or '').strip().lower()
        plus_ones = int(request.data.get('plus_ones', 0) or 0)
        message = (request.data.get('response_message') or '').strip()

        if status_value not in {'accepted', 'declined'}:
            return Response({'detail': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        if not token:
            return Response({'detail': 'invitation_token is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = EventInvitation.objects.select_related('event', 'event__brand__user', 'influencer__user').get(
                invite_token=token,
            )
        except EventInvitation.DoesNotExist:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

        if invitation.influencer_id and getattr(request.user, 'is_authenticated', False):
            if request.user.user_type == 'influencer':
                try:
                    if invitation.influencer_id != request.user.influencer_profile.id:
                        return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
                except InfluencerProfile.DoesNotExist:
                    return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        if plus_ones < 0:
            plus_ones = 0
        if plus_ones > invitation.max_plus_ones:
            return Response({'detail': f'Maximum +{invitation.max_plus_ones} allowed for this invitation.'}, status=status.HTTP_400_BAD_REQUEST)

        invitation.status = status_value
        invitation.plus_ones_confirmed = plus_ones if status_value == 'accepted' else 0
        invitation.response_message = message
        invitation.responded_at = timezone.now()
        invitation.save(update_fields=['status', 'plus_ones_confirmed', 'response_message', 'responded_at', 'updated_at'])

        recipient_email = invitation.invited_email or (invitation.influencer.user.email if invitation.influencer_id else '')
        if recipient_email:
            lang = (
                invitation.influencer.user.language_preference
                if invitation.influencer_id and invitation.influencer and invitation.influencer.user
                else 'en'
            )
            status_label = (
                ('Présent' if status_value == 'accepted' else 'Absent')
                if (lang or '').lower().startswith('fr')
                else ('Attending' if status_value == 'accepted' else 'Not attending')
            )
            email_service.send_event_rsvp_confirmation(
                recipient_email=recipient_email,
                event_title=invitation.event.title,
                status_label=status_label,
                plus_ones_confirmed=invitation.plus_ones_confirmed,
                language=lang,
            )

        return Response(EventInvitationSerializer(invitation, context={'request': request}).data, status=status.HTTP_200_OK)


class EventInvitationDetailByTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, invite_token):
        try:
            invitation = EventInvitation.objects.select_related('event', 'influencer__user', 'checked_in_by').get(invite_token=invite_token)
        except EventInvitation.DoesNotExist:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(EventInvitationSerializer(invitation, context={'request': request}).data)


class EventCheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.user_type != 'brand':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        token = str(request.data.get('invitation_token') or '').strip()
        qr_payload = str(request.data.get('qr_payload') or '').strip()

        if not token and qr_payload.startswith('IC-EVT:'):
            parts = qr_payload.split(':', 2)
            if len(parts) == 3:
                token = parts[2]

        if not token:
            return Response({'detail': 'invitation_token or qr_payload is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = EventInvitation.objects.select_related('event__brand', 'influencer__user').get(invite_token=token)
        except EventInvitation.DoesNotExist:
            return Response({'detail': 'Invitation not found.'}, status=status.HTTP_404_NOT_FOUND)

        brand = _active_brand(request)
        if not brand:
            return Response({'detail': 'Brand profile not found.'}, status=status.HTTP_403_FORBIDDEN)

        if invitation.event.brand_id != brand.id:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        if invitation.status != 'accepted':
            return Response({'detail': 'Invitation is not accepted yet.'}, status=status.HTTP_400_BAD_REQUEST)

        already = bool(invitation.checked_in_at)
        if not already:
            invitation.checked_in_at = timezone.now()
            invitation.checked_in_by = request.user
            invitation.save(update_fields=['checked_in_at', 'checked_in_by', 'updated_at'])

        return Response({
            'checked_in': True,
            'already_checked_in': already,
            'invitation': EventInvitationSerializer(invitation, context={'request': request}).data,
        })


# ---------------------------------------------------------------------------
# Proposal helpers
# ---------------------------------------------------------------------------

def _get_proposal_for_influencer(request, pk):
    try:
        proposal = CampaignProposal.objects.get(pk=pk)
    except CampaignProposal.DoesNotExist:
        return None, Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.user.user_type != "influencer":
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    try:
        profile = request.user.influencer_profile
    except InfluencerProfile.DoesNotExist:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    if proposal.influencer != profile:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return proposal, None


def _get_proposal_for_brand(request, pk):
    try:
        proposal = CampaignProposal.objects.get(pk=pk)
    except CampaignProposal.DoesNotExist:
        return None, Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    if request.user.user_type != "brand":
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    profile = _active_brand(request)
    if not profile:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    if proposal.campaign.brand != profile:
        return None, Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
    return proposal, None


# ---------------------------------------------------------------------------
# Proposal views
# ---------------------------------------------------------------------------

class ProposalListView(generics.ListAPIView):
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # The serializer reads campaign.brand, influencer.user and the latest
        # submission of every row — load them upfront.
        qs = CampaignProposal.objects.select_related(
            "campaign__brand", "influencer__user",
        ).prefetch_related(
            models.Prefetch("submissions", queryset=ContentSubmission.objects.order_by("-created_at")),
        )
        if user.user_type == "influencer":
            try:
                return qs.filter(influencer=user.influencer_profile).order_by("-created_at")
            except InfluencerProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        elif user.user_type == "brand":
            brand = _active_brand(self.request)
            if not brand:
                return CampaignProposal.objects.none()
            return qs.filter(campaign__brand=brand).order_by("-created_at")
        return qs.order_by("-created_at")


class ProposalDetailView(generics.RetrieveAPIView):
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = CampaignProposal.objects.select_related("campaign__brand", "influencer__user")
        if user.user_type == "influencer":
            try:
                return qs.filter(influencer=user.influencer_profile)
            except InfluencerProfile.DoesNotExist:
                return CampaignProposal.objects.none()
        elif user.user_type == "brand":
            brand = _active_brand(self.request)
            if not brand:
                return CampaignProposal.objects.none()
            return qs.filter(campaign__brand=brand)
        return qs


class ProposalAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        if proposal.status not in ("pending", "counter_offer"):
            return Response(
                {"detail": "Proposal cannot be accepted in its current state."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.status = "accepted"
        proposal.save()
        for recipient in _brand_users(proposal.campaign.brand):
            create_notification(
                user=recipient,
                notification_type="proposal_accepted",
                title=_notif_text(recipient, "Proposition acceptee", "Proposal accepted"),
                message=_notif_text(
                    recipient,
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'a accepte votre proposition pour "{proposal.campaign.title}".',
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'accepted your proposal for "{proposal.campaign.title}".',
                ),
                proposal=proposal,
            )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        decline_reason = request.data.get("decline_reason", "")
        if not decline_reason:
            return Response({"detail": "decline_reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.status = "declined"
        proposal.decline_reason = decline_reason
        proposal.save()
        for recipient in _brand_users(proposal.campaign.brand):
            create_notification(
                user=recipient,
                notification_type="proposal_declined",
                title=_notif_text(recipient, "Proposition refusee", "Proposal declined"),
                message=_notif_text(
                    recipient,
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'a refuse votre proposition pour "{proposal.campaign.title}".',
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'declined your proposal for "{proposal.campaign.title}".',
                ),
                proposal=proposal,
            )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalCounterOfferView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        counter_price = request.data.get("counter_price")
        if counter_price is None:
            return Response({"detail": "counter_price is required."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.status = "counter_offer"
        proposal.counter_price = counter_price
        proposal.counter_message = request.data.get("counter_message", "")
        proposal.save()
        for recipient in _brand_users(proposal.campaign.brand):
            create_notification(
                user=recipient,
                notification_type="counter_offer",
                title=_notif_text(recipient, "Contre-offre recue", "Counter offer received"),
                message=_notif_text(
                    recipient,
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'vous a envoye une contre-offre pour "{proposal.campaign.title}".',
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'sent a counter offer for "{proposal.campaign.title}".',
                ),
                proposal=proposal,
            )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalAcceptCounterView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "counter_offer":
            return Response({"detail": "No counter offer to accept."}, status=status.HTTP_400_BAD_REQUEST)
        proposal.proposed_price = proposal.counter_price
        proposal.status = "accepted"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="proposal_accepted",
            title=_notif_text(proposal.influencer.user, "Contre-offre acceptee", "Counter offer accepted"),
            message=_notif_text(
                proposal.influencer.user,
                f'Votre contre-offre pour "{proposal.campaign.title}" a ete acceptee.',
                f'Your counter offer for "{proposal.campaign.title}" was accepted.',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalCancelView(APIView):
    """Brand cancels a proposal they sent (only in pending / counter_offer states)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status not in ("pending", "counter_offer"):
            return Response(
                {"detail": "Proposal cannot be cancelled in its current state."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.status = "declined"
        proposal.decline_reason = request.data.get("reason", "Cancelled by brand")
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="proposal_declined",
            title=_notif_text(proposal.influencer.user, "Proposition annulee", "Proposal cancelled"),
            message=_notif_text(
                proposal.influencer.user,
                f'La marque a annule la proposition pour "{proposal.campaign.title}".',
                f'The brand cancelled the proposal for "{proposal.campaign.title}".',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class BrandPublicDetailView(generics.RetrieveAPIView):
    """Public brand profile view (auth required) — used by influencers to inspect a brand."""
    permission_classes = [IsAuthenticated]
    serializer_class = BrandProfileSerializer
    queryset = BrandProfile.objects.all()


class ProposalSignContractView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not proposal.contract_pdf:
            return Response({"detail": "Contract must be generated first."},
                            status=status.HTTP_400_BAD_REQUEST)
        # Consent flag is required by UI for legal acknowledgement.
        if request.data.get("consent") is not True:
            return Response({"detail": "Consent is required."}, status=status.HTTP_400_BAD_REQUEST)

        err = _sign_proposal(
            proposal,
            request.user,
            ip=_client_ip(request),
            signature_payload=_extract_signature_payload(request.data, request.user, proposal),
        )
        if err:
            return err
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalSignSessionCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand__user", "influencer__user"
            ).get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not proposal.contract_pdf:
            return Response({"detail": "Contract must be generated first."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        is_brand = (
            user.user_type == "brand"
            and get_user_role_for_brand(user, proposal.campaign.brand) in ("owner", "admin")
        )
        is_influencer = user.user_type == "influencer" and proposal.influencer.user_id == user.id
        if not is_brand and not is_influencer:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if is_brand and proposal.brand_signed_at:
            return Response({"detail": "Brand has already signed."}, status=status.HTTP_400_BAD_REQUEST)
        if is_influencer and not proposal.brand_signed_at:
            return Response({"detail": "Brand must sign first."}, status=status.HTTP_400_BAD_REQUEST)
        if is_influencer and proposal.influencer_signed_at:
            return Response({"detail": "Influencer has already signed."}, status=status.HTTP_400_BAD_REQUEST)

        token = _build_sign_session_token(proposal.id, user.id)
        expires_at = timezone.now() + timedelta(seconds=SIGN_SESSION_TTL_SECONDS)
        sign_url = f"{django_settings.FRONTEND_URL.rstrip('/')}/sign/mobile/{token}"
        return Response({
            "token": token,
            "sign_url": sign_url,
            "expires_at": expires_at.isoformat(),
        })


class ProposalSignSessionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        proposal_id, user_id = _decode_sign_session_token(token)
        if not proposal_id or not user_id:
            return Response({"detail": "Session not found or expired."}, status=status.HTTP_404_NOT_FOUND)

        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand__user", "influencer__user"
            ).get(pk=proposal_id)
            signer = User.objects.get(pk=user_id)
        except (CampaignProposal.DoesNotExist, User.DoesNotExist):
            return Response({"detail": "Session not found or expired."}, status=status.HTTP_404_NOT_FOUND)

        used = _session_used_for_signer(proposal, signer)
        completed_at = _session_completed_at_for_signer(proposal, signer)
        expires_at = (timezone.now() + timedelta(seconds=SIGN_SESSION_TTL_SECONDS)).isoformat()
        if signer.user_type == "brand" and hasattr(signer, "brand_profile"):
            signer_label = signer.brand_profile.company_name or signer.username
        elif signer.user_type == "influencer" and hasattr(signer, "influencer_profile"):
            signer_label = (
                signer.influencer_profile.display_name
                or signer.get_full_name().strip()
                or signer.username
            )
        else:
            signer_label = signer.get_full_name().strip() or signer.username
        return Response({
            "token": token,
            "proposal_id": proposal.id,
            "used": used,
            "expires_at": expires_at,
            "completed_at": completed_at,
            "signer_role": signer.user_type,
            "signer_label": signer_label,
        })


class ProposalSignSessionCompleteView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, token):
        proposal_id, user_id = _decode_sign_session_token(token)
        if not proposal_id or not user_id:
            return Response({"detail": "Session not found or expired."}, status=status.HTTP_404_NOT_FOUND)

        if request.data.get("consent") is not True:
            return Response({"detail": "Consent is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            proposal = CampaignProposal.objects.select_related(
                "campaign__brand__user", "influencer__user"
            ).get(pk=proposal_id)
            signer = User.objects.get(pk=user_id)
        except (CampaignProposal.DoesNotExist, User.DoesNotExist):
            return Response({"detail": "Invalid signing session."}, status=status.HTTP_400_BAD_REQUEST)

        if _session_used_for_signer(proposal, signer):
            return Response({"detail": "This signing link has already been used."}, status=status.HTTP_400_BAD_REQUEST)

        if signer.user_type == "brand" and get_user_role_for_brand(signer, proposal.campaign.brand) not in ("owner", "admin"):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if signer.user_type == "influencer" and proposal.influencer.user_id != signer.id:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        err = _sign_proposal(
            proposal,
            signer,
            ip=_client_ip(request),
            signature_payload=_extract_signature_payload(request.data, signer, proposal),
        )
        if err:
            return err

        completed_at = _session_completed_at_for_signer(proposal, signer)

        return Response({
            "ok": True,
            "proposal_id": proposal.id,
            "completed_at": completed_at,
        })


class ProposalFundEscrowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "contract_signed":
            return Response(
                {"detail": "Contract must be signed before funding escrow."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        amount = Decimal(str(request.data.get("amount", proposal.proposed_price)))
        # Stripe stub — create escrow PaymentIntent
        brand_profile = proposal.campaign.brand
        if not brand_profile.stripe_customer_id:
            brand_profile.stripe_customer_id = stripe_service.create_customer(
                email=brand_profile.user.email, name=brand_profile.company_name,
            )
            brand_profile.save(update_fields=["stripe_customer_id"])
        pi = stripe_service.create_escrow_payment_intent(
            customer_id=brand_profile.stripe_customer_id,
            amount_eur=amount, proposal_id=proposal.id,
        )
        stripe_service.confirm_escrow_payment(pi["id"])
        proposal.stripe_payment_intent_id = pi["id"]
        proposal.escrow_amount = amount
        proposal.escrow_funded = True
        proposal.escrow_funded_at = timezone.now()
        proposal.status = "in_progress"
        # Compute submission deadline (campaign deadline or +14 days)
        if proposal.campaign.deadline:
            proposal.submission_deadline = timezone.datetime.combine(
                proposal.campaign.deadline, timezone.datetime.min.time(),
                tzinfo=timezone.get_current_timezone(),
            )
        else:
            proposal.submission_deadline = timezone.now() + timedelta(days=14)
        proposal.save()
        _audit(request.user, "escrow_funded", "CampaignProposal", proposal.id,
               metadata={"amount": str(amount)}, ip=_client_ip(request))
        email_service.send_escrow_funded(
            proposal.influencer.user.email,
            str(amount),
            proposal.campaign.title,
            language=proposal.influencer.user.language_preference,
        )
        create_notification(
            user=proposal.influencer.user,
            notification_type="escrow_funded",
            title=_notif_text(proposal.influencer.user, "Escrow approvisionne", "Escrow funded"),
            message=_notif_text(
                proposal.influencer.user,
                f'La marque a approvisionne l\'escrow pour "{proposal.campaign.title}". Vous pouvez commencer.',
                f'The brand has funded the escrow for "{proposal.campaign.title}". You can start working!',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalSubmitContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_influencer(request, pk)
        if err:
            return err
        if proposal.status != "in_progress":
            return Response(
                {"detail": "Proposal must be in progress to submit content."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()
        submission_type = data.get("submission_type")
        publication_url = data.get("publication_url")
        uploaded_file = request.FILES.get("uploaded_file")

        if submission_type == "link" and not publication_url:
            return Response({"detail": "publication_url is required for link submissions."}, status=status.HTTP_400_BAD_REQUEST)
        if submission_type == "upload" and not uploaded_file:
            return Response({"detail": "uploaded_file is required for upload submissions."}, status=status.HTTP_400_BAD_REQUEST)

        # For pre-publication review, a file-only submission is valid.
        if submission_type == "upload" and not publication_url:
            data["publication_url"] = ""

        data["proposal"] = proposal.pk
        serializer = ContentSubmissionSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        submission = serializer.save()

        proposal.status = "content_submitted"
        # Brand has 5 days to validate (CDC §2.2)
        deadline_days = PlatformSettings.get_instance().validation_deadline_days
        proposal.validation_deadline = timezone.now() + timedelta(days=int(deadline_days))
        proposal.save()
        for recipient in _brand_users(proposal.campaign.brand):
            create_notification(
                user=recipient,
                notification_type="content_submitted",
                title=_notif_text(recipient, "Contenu soumis", "Content submitted"),
                message=_notif_text(
                    recipient,
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'a soumis du contenu pour "{proposal.campaign.title}".',
                    f"{proposal.influencer.display_name or proposal.influencer.user.username} "
                    f'submitted content for "{proposal.campaign.title}".',
                ),
                proposal=proposal,
            )
        brand_contact = _brand_primary_user(proposal.campaign.brand)
        if brand_contact and brand_contact.email:
            email_service.send_content_submitted_to_brand(
                brand_contact.email,
                proposal.campaign.title,
                proposal.influencer.display_name or proposal.influencer.user.username,
                language=brand_contact.language_preference,
            )
        return Response(ContentSubmissionSerializer(submission, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ProposalLatestSubmissionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err

        submission = proposal.submissions.order_by("-created_at").first()
        if not submission:
            return Response({"detail": "No submission found."}, status=status.HTTP_404_NOT_FOUND)

        return Response(ContentSubmissionSerializer(submission, context={"request": request}).data)


class ProposalSubmissionAssetView(APIView):
    """Serve submission files/screenshots only to related brand/influencer participants."""
    permission_classes = [IsAuthenticated]

    def get(self, request, submission_id, asset):
        try:
            submission = ContentSubmission.objects.select_related(
                'proposal__campaign__brand', 'proposal__influencer',
            ).get(pk=submission_id)
        except ContentSubmission.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        proposal = submission.proposal
        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
            or user.is_staff
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if asset == 'uploaded_file':
            file_field = submission.uploaded_file
        elif asset == 'screenshot':
            file_field = submission.screenshot
        else:
            return Response({"detail": "Invalid asset."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_field:
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        return FileResponse(
            file_field.open('rb'),
            as_attachment=False,
            filename=file_field.name.rsplit('/', 1)[-1],
        )


class ProposalValidateContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "content_submitted":
            return Response({"detail": "No content to validate."}, status=status.HTTP_400_BAD_REQUEST)

        submission = proposal.submissions.order_by("-created_at").first()
        if not submission:
            return Response({"detail": "No submission found."}, status=status.HTTP_404_NOT_FOUND)

        submission.brand_validated = True
        submission.brand_validation_date = timezone.now()
        submission.save()
        proposal.status = "validated"
        proposal.save()
        _audit(request.user, "content_validated", "CampaignProposal", proposal.id,
               ip=_client_ip(request))
        if proposal.influencer.user.email:
            email_service.send_content_validated(
                proposal.influencer.user.email,
                proposal.campaign.title,
                language=proposal.influencer.user.language_preference,
            )
        # Auto-release escrow after validation (CDC §2.1)
        if proposal.escrow_funded and not proposal.escrow_released:
            settings_obj = PlatformSettings.get_instance()
            commission_rate = _effective_commission_rate_for_proposal(
                proposal,
                Decimal(str(settings_obj.commission_rate)),
            )
            try:
                release = stripe_service.release_escrow_to_influencer(
                    payment_intent_id=proposal.stripe_payment_intent_id or "stub",
                    influencer_account_id=proposal.influencer.stripe_account_id or None,
                    amount_eur=Decimal(str(proposal.escrow_amount)),
                    commission_rate=commission_rate,
                )
                proposal.stripe_transfer_id = release["transfer_id"]
                proposal.escrow_released = True
                proposal.escrow_released_at = timezone.now()
                proposal.status = "paid"
                proposal.save()
                _audit(request.user, "escrow_released", "CampaignProposal", proposal.id,
                       metadata=release, ip=_client_ip(request))
                email_service.send_payment_released(
                    proposal.influencer.user.email,
                    release["net_amount_eur"],
                    proposal.campaign.title,
                    language=proposal.influencer.user.language_preference,
                )
                create_notification(
                    user=proposal.influencer.user,
                    notification_type="payment_released",
                    title=_notif_text(proposal.influencer.user, "Paiement libere", "Payment released"),
                    message=_notif_text(
                        proposal.influencer.user,
                        f'Le paiement pour "{proposal.campaign.title}" a ete libere.',
                        f'Payment for "{proposal.campaign.title}" has been released.',
                    ),
                    proposal=proposal,
                )
            except Exception:
                pass
        create_notification(
            user=proposal.influencer.user,
            notification_type="content_validated",
            title=_notif_text(proposal.influencer.user, "Contenu valide", "Content validated"),
            message=_notif_text(
                proposal.influencer.user,
                f'Votre contenu pour "{proposal.campaign.title}" a ete valide par la marque.',
                f'Your content for "{proposal.campaign.title}" was validated by the brand.',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalRejectContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        proposal, err = _get_proposal_for_brand(request, pk)
        if err:
            return err
        if proposal.status != "content_submitted":
            return Response({"detail": "No content to reject."}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = request.data.get("rejection_reason")
        if not rejection_reason:
            return Response({"detail": "rejection_reason is required."}, status=status.HTTP_400_BAD_REQUEST)

        submission = proposal.submissions.order_by("-created_at").first()
        if not submission:
            return Response({"detail": "No submission found."}, status=status.HTTP_404_NOT_FOUND)

        submission.brand_validated = False
        submission.brand_validation_date = timezone.now()
        submission.rejection_reason = rejection_reason
        submission.rejection_comment = request.data.get("rejection_comment", "")
        submission.correction_requested = True
        submission.save()
        proposal.status = "in_progress"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="content_rejected",
            title=_notif_text(proposal.influencer.user, "Contenu refuse", "Content rejected"),
            message=_notif_text(
                proposal.influencer.user,
                f'Votre contenu pour "{proposal.campaign.title}" a ete refuse. Motif : {rejection_reason}.',
                f'Your content for "{proposal.campaign.title}" was rejected. Reason: {rejection_reason}.',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


class ProposalReleasePaymentView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if proposal.status not in ("validated", "disputed"):
            return Response(
                {"detail": "Payment can only be released for validated or resolved proposals."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        proposal.escrow_released = True
        proposal.status = "paid"
        proposal.save()
        create_notification(
            user=proposal.influencer.user,
            notification_type="payment_released",
            title=_notif_text(proposal.influencer.user, "Paiement libere", "Payment released"),
            message=_notif_text(
                proposal.influencer.user,
                f'Le paiement pour "{proposal.campaign.title}" vous a ete libere.',
                f'Payment for "{proposal.campaign.title}" has been released to you.',
            ),
            proposal=proposal,
        )
        return Response(CampaignProposalSerializer(proposal).data)


# ---------------------------------------------------------------------------
# Message views
# ---------------------------------------------------------------------------

class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get_queryset(self):
        pk = self.kwargs["pk"]
        user = self.request.user
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Message.objects.none()

        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
            or user.is_staff
        )
        if not is_participant:
            return Message.objects.none()

        return Message.objects.filter(proposal=proposal).select_related("sender").order_by("created_at")

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        Message.objects.filter(
            proposal_id=self.kwargs.get("pk"),
            read=False,
        ).exclude(sender=request.user).update(read=True)
        return response


class MessageCreateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
            or user.is_staff
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        content = (request.data.get("content") or "").strip()
        attachment = request.FILES.get("attachments") or request.data.get("attachments")
        if not content and not attachment:
            return Response(
                {"detail": "content or attachments is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()
        data["proposal"] = pk
        data["content"] = _encrypt_message_text(content)
        serializer = MessageSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        msg = serializer.save(sender=request.user)

        if user.user_type == "influencer":
            recipients = _brand_users(proposal.campaign.brand)
        else:
            recipients = [proposal.influencer.user]

        for recipient in recipients:
            if recipient.id == user.id:
                continue
            create_notification(
                user=recipient,
                notification_type="new_message",
                title="New message",
                message=f'You have a new message from {user.username} about "{proposal.campaign.title}".',
                proposal=proposal,
            )
        return Response(MessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ProposalContractDownloadView(APIView):
    """Serve proposal contract PDF only to the related brand/influencer participants."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            proposal = CampaignProposal.objects.select_related(
                'campaign__brand', 'influencer',
            ).get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not proposal.contract_pdf:
            return Response({"detail": "Contract not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
            or user.is_staff
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        return FileResponse(
            proposal.contract_pdf.open('rb'),
            as_attachment=False,
            filename=proposal.contract_pdf.name.rsplit('/', 1)[-1],
        )


# ---------------------------------------------------------------------------
# Direct message views
# ---------------------------------------------------------------------------

class ConversationsListView(generics.ListAPIView):
    """Get all conversations (direct messages + campaign proposals with messages)."""
    permission_classes = [IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        user = request.user
        conversations = []

        # Direct messages — ordered by -created_at, so the first row seen for a
        # peer IS the last message of that conversation (no per-peer queries).
        dm_qs = DirectMessage.objects.filter(
            models.Q(sender=user) | models.Q(recipient=user)
        ).select_related('sender', 'recipient').order_by('-created_at')
        unread_by_sender = {
            row['sender_id']: row['n']
            for row in DirectMessage.objects.filter(recipient=user, read=False)
            .values('sender_id').annotate(n=models.Count('id'))
        }
        dm_users = set()
        for dm in dm_qs:
            other_user = dm.recipient if dm.sender_id == user.id else dm.sender
            if other_user.id in dm_users:
                continue
            dm_users.add(other_user.id)
            conversations.append({
                'type': 'direct',
                'id': f'dm_{other_user.id}',
                'other_user': {
                    'id': other_user.id,
                    'username': _conversation_display_name(other_user),
                    'avatar': _abs_media_url(request, getattr(other_user, 'avatar', None))
                },
                'last_message': _decrypt_message_text(dm.content),
                'created_at': dm.created_at,
                'unread_count': unread_by_sender.get(other_user.id, 0),
            })

        # Campaign proposal conversations (if they have messages). Messages are
        # prefetched newest-first: last message + unread count come from cache.
        proposals = None
        if user.user_type == "brand":
            brand = _active_brand(request)
            if brand:
                proposals = CampaignProposal.objects.filter(
                    campaign__brand=brand, messages__isnull=False,
                ).distinct().select_related('campaign', 'influencer__user')
        elif user.user_type == "influencer":
            try:
                proposals = CampaignProposal.objects.filter(
                    influencer=user.influencer_profile, messages__isnull=False,
                ).distinct().select_related('campaign__brand__user')
            except InfluencerProfile.DoesNotExist:
                proposals = None

        if proposals is not None:
            proposals = proposals.order_by('-updated_at').prefetch_related(
                models.Prefetch('messages', queryset=Message.objects.order_by('-created_at')),
            )
            for proposal in proposals:
                messages = list(proposal.messages.all())
                if not messages:
                    continue
                last_msg = messages[0]
                other = (
                    proposal.influencer.user if user.user_type == "brand"
                    else proposal.campaign.brand.user
                )
                conversations.append({
                    'type': 'campaign',
                    'id': f'campaign_{proposal.id}',
                    'proposal_id': proposal.id,
                    'campaign': proposal.campaign.title,
                    'other_user': {
                        'id': other.id,
                        'username': _conversation_display_name(other),
                        'avatar': _abs_media_url(request, getattr(other, 'avatar', None))
                    },
                    'last_message': _decrypt_message_text(last_msg.content),
                    'created_at': last_msg.created_at,
                    'unread_count': sum(1 for m in messages if not m.read and m.sender_id != user.id),
                })

        # Sort by most recent
        conversations.sort(key=lambda x: x['created_at'], reverse=True)

        return Response(conversations)


class DirectMessageListView(generics.ListAPIView):
    """Get direct messages with a specific user."""
    serializer_class = DirectMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        other_user_id = self.kwargs.get('other_user_id')
        
        return DirectMessage.objects.filter(
            models.Q(sender=user, recipient_id=other_user_id) |
            models.Q(sender_id=other_user_id, recipient=user)
        ).select_related('sender', 'recipient').order_by('created_at')

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        other_user_id = self.kwargs.get('other_user_id')
        DirectMessage.objects.filter(
            sender_id=other_user_id,
            recipient=request.user,
            read=False,
        ).update(read=True)
        return response


class DirectMessageCreateView(APIView):
    """Create a direct message."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def post(self, request):
        user = request.user
        recipient_id = request.data.get('recipient_id')
        content = (request.data.get('content') or '').strip()
        attachment = request.FILES.get('attachments') or request.data.get('attachments')
        
        if not recipient_id:
            return Response({'detail': 'recipient_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not content and not attachment:
            return Response({'detail': 'content or attachments is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            recipient = User.objects.get(pk=recipient_id)
        except User.DoesNotExist:
            return Response({'detail': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        dm = DirectMessage.objects.create(
            sender=user,
            recipient=recipient,
            content=_encrypt_message_text(content),
            attachments=attachment or None,
        )
        
        return Response(
            DirectMessageSerializer(dm, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )


class CampaignMessageAttachmentView(APIView):
    """Serve campaign message attachments only to conversation participants."""
    permission_classes = [IsAuthenticated]

    def get(self, request, message_id):
        try:
            msg = Message.objects.select_related(
                'proposal__campaign__brand', 'proposal__influencer',
            ).get(pk=message_id)
        except Message.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not msg.attachments:
            return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        proposal = msg.proposal
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
            or user.is_staff
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        return FileResponse(
            msg.attachments.open('rb'),
            as_attachment=False,
            filename=msg.attachments.name.rsplit('/', 1)[-1],
        )


class DirectMessageAttachmentView(APIView):
    """Serve direct message attachments only to sender/recipient."""
    permission_classes = [IsAuthenticated]

    def get(self, request, message_id):
        try:
            dm = DirectMessage.objects.select_related('sender', 'recipient').get(pk=message_id)
        except DirectMessage.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if not dm.attachments:
            return Response({"detail": "Attachment not found."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user != dm.sender and user != dm.recipient and not user.is_staff:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        return FileResponse(
            dm.attachments.open('rb'),
            as_attachment=False,
            filename=dm.attachments.name.rsplit('/', 1)[-1],
        )


# ---------------------------------------------------------------------------
# Review views
# ---------------------------------------------------------------------------

class ReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if proposal.status != "paid":
            return Response(
                {"detail": "Reviews can only be created for paid proposals."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        is_participant = (
            (user.user_type == "influencer"
             and hasattr(user, "influencer_profile")
             and proposal.influencer == user.influencer_profile)
            or (user.user_type == "brand"
                and user_can_access_brand(user, proposal.campaign.brand))
        )
        if not is_participant:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        if user.user_type == "influencer":
            reviewee = proposal.campaign.brand.user
        else:
            reviewee = proposal.influencer.user

        if Review.objects.filter(proposal=proposal, reviewer=user).exists():
            return Response(
                {"detail": "You have already reviewed this proposal."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = request.data.copy()
        data["proposal"] = pk
        data["reviewee"] = reviewee.pk
        serializer = ReviewSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        review = serializer.save(reviewer=user)
        _update_average_rating(reviewee)
        create_notification(
            user=reviewee,
            notification_type="new_review",
            title="New review",
            message=f"{user.username} left you a {review.rating}/5 review.",
            proposal=proposal,
        )
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class UserReviewListView(generics.ListAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(reviewee_id=self.kwargs["pk"]).select_related("reviewer", "reviewee").order_by("-created_at")


# ---------------------------------------------------------------------------
# Notification views
# ---------------------------------------------------------------------------

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by("-created_at")


class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        notif.read = True
        notif.save()
        return Response(NotificationSerializer(notif).data)


class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Notification.objects.filter(user=request.user, read=False).update(read=True)
        return Response({"detail": "All notifications marked as read."})


# ---------------------------------------------------------------------------
# Admin views
# ---------------------------------------------------------------------------

class AdminUserListView(generics.ListAPIView):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]


class AdminCampaignListView(generics.ListAPIView):
    queryset = Campaign.objects.select_related("brand").order_by("-created_at")
    serializer_class = CampaignSerializer
    permission_classes = [IsAdminUser]


class AdminProposalListView(generics.ListAPIView):
    queryset = CampaignProposal.objects.select_related(
        "campaign__brand", "influencer__user",
    ).prefetch_related(
        models.Prefetch("submissions", queryset=ContentSubmission.objects.order_by("-created_at")),
    ).order_by("-created_at")
    serializer_class = CampaignProposalSerializer
    permission_classes = [IsAdminUser]


class AdminArbitrateView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            proposal = CampaignProposal.objects.get(pk=pk)
        except CampaignProposal.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        decision = request.data.get("decision")
        if decision not in ("validated", "disputed"):
            return Response(
                {"detail": 'decision must be "validated" or "disputed".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        admin_notes = request.data.get("admin_notes", "")
        submission = proposal.submissions.order_by("-created_at").first()
        if submission:
            submission.admin_validated = (decision == "validated")
            submission.admin_notes = admin_notes
            submission.save()

        proposal.status = decision
        proposal.save()
        return Response(CampaignProposalSerializer(proposal).data)


class AdminFinancialsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        settings_obj = PlatformSettings.get_instance()
        commission_rate = float(settings_obj.commission_rate) / 100

        total_escrow = CampaignProposal.objects.filter(
            escrow_funded=True
        ).aggregate(total=Sum("escrow_amount"))["total"] or 0

        total_released = CampaignProposal.objects.filter(
            escrow_released=True
        ).aggregate(total=Sum("escrow_amount"))["total"] or 0

        total_commission = float(total_released) * commission_rate

        return Response({
            "total_escrow_funded": total_escrow,
            "total_payments_released": total_released,
            "estimated_commission": round(total_commission, 2),
            "commission_rate_percent": settings_obj.commission_rate,
            "total_paid_proposals": CampaignProposal.objects.filter(status="paid").count(),
            "total_active_proposals": CampaignProposal.objects.filter(
                status__in=["accepted", "contract_signed", "in_progress", "content_submitted"]
            ).count(),
        })


class AdminSettingsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        settings_obj = PlatformSettings.get_instance()
        return Response(PlatformSettingsSerializer(settings_obj).data)

    def put(self, request):
        settings_obj = PlatformSettings.get_instance()
        serializer = PlatformSettingsSerializer(settings_obj, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        settings_obj = PlatformSettings.get_instance()
        serializer = PlatformSettingsSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
