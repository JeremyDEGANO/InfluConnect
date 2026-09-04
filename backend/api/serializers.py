from django.contrib.auth import authenticate
from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from cryptography.fernet import Fernet, InvalidToken
from django.urls import reverse
import base64
import hashlib
import secrets
import re
import unicodedata
import bleach
import zipfile
import os

from .services.translation_service import translate as _translate

from .models import (
    User, InfluencerProfile, SocialNetwork, SocialVideo, SocialStatsSnapshot,
    SocialFraudFlag, BrandProfile,
    Campaign, CampaignDocument, CampaignProposal, CampaignVideoTracking, CampaignVideoDailyStats,
    Event, EventInvitation, ContentSubmission,
    Message, DirectMessage, Review, Notification, PlatformSettings,
    ContractTemplate, CastingApplication, AmbassadorProgram, AuditLog,
    MediaKitImage, BrandMembership, AgencyDelegation, SupportTicket,
    SupportTicketImage,
    InfluencerReferralInvite,
)
from .workspace import get_user_brand_workspaces, get_user_role_for_brand, user_can_access_brand


# ---------------------------------------------------------------------------
# Crypto helpers (Fernet)
# ---------------------------------------------------------------------------
def get_fernet():
    key = getattr(settings, 'FERNET_KEY', None)
    if not key:
        import warnings
        warnings.warn(
            "FERNET_KEY is not set in environment variables. "
            "Encryption is using an insecure fallback key. Set FERNET_KEY in production.",
            RuntimeWarning,
            stacklevel=2,
        )
        raw = b'influconnect-default-encryption-key-32b!'
        key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    elif isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def _decrypt_message_text(value: str) -> str:
    raw = value or ''
    if not raw.startswith('enc:v1:'):
        return raw
    token = raw[len('enc:v1:'):]
    try:
        return get_fernet().decrypt(token.encode('utf-8')).decode('utf-8')
    except (InvalidToken, ValueError):
        return ''


def encrypt_value(value: str) -> str:
    if not value:
        return value
    return get_fernet().encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    if not value:
        return value
    try:
        return get_fernet().decrypt(value.encode()).decode()
    except (InvalidToken, Exception):
        return value


def _abs_media_url(request, file_field):
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None
    return request.build_absolute_uri(url) if request else url


PSEUDO_REGEX = re.compile(r'^[\w.-]+\Z', re.UNICODE)

CONTRACT_HTML_TAGS = {
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'code', 'pre',
    'ul', 'ol', 'li', 'a', 'mark',
}
CONTRACT_HTML_ATTRIBUTES = {'a': ['href', 'title', 'target', 'rel']}


def sanitize_contract_html(value: str) -> str:
    return bleach.clean(
        value or '',
        tags=CONTRACT_HTML_TAGS,
        attributes=CONTRACT_HTML_ATTRIBUTES,
        protocols={'http', 'https', 'mailto'},
        strip=True,
        strip_comments=True,
    )


def validate_uploaded_file(file_obj, *, max_bytes: int, extensions: set[str], content_types: set[str] | None = None):
    if not file_obj:
        return file_obj
    if file_obj.size > max_bytes:
        raise serializers.ValidationError(f'File exceeds the {max_bytes // (1024 * 1024)} MB limit.')
    name = (file_obj.name or '').lower()
    extension = '.' + name.rsplit('.', 1)[-1] if '.' in name else ''
    if extension not in extensions:
        raise serializers.ValidationError('Unsupported file extension.')
    content_type = (getattr(file_obj, 'content_type', '') or '').lower()
    if content_types and content_type not in content_types:
        raise serializers.ValidationError('Unsupported file content type.')
    return file_obj


def validate_pdf(file_obj, *, max_bytes: int = 10 * 1024 * 1024):
    validate_uploaded_file(
        file_obj, max_bytes=max_bytes, extensions={'.pdf'},
        content_types={'application/pdf'},
    )
    position = file_obj.tell()
    try:
        if file_obj.read(5) != b'%PDF-':
            raise serializers.ValidationError('Invalid PDF file signature.')
    finally:
        file_obj.seek(position)
    return file_obj


def validate_contract_source(file_obj):
    validate_uploaded_file(
        file_obj, max_bytes=10 * 1024 * 1024, extensions={'.pdf', '.docx'},
        content_types={
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
    )
    if (file_obj.name or '').lower().endswith('.pdf'):
        return validate_pdf(file_obj)
    position = file_obj.tell()
    try:
        if not zipfile.is_zipfile(file_obj):
            raise serializers.ValidationError('Invalid DOCX file signature.')
        file_obj.seek(0)
        with zipfile.ZipFile(file_obj) as archive:
            names = set(archive.namelist())
            if '[Content_Types].xml' not in names or 'word/document.xml' not in names:
                raise serializers.ValidationError('Invalid DOCX document structure.')
            if len(names) > 2000 or sum(item.file_size for item in archive.infolist()) > 50 * 1024 * 1024:
                raise serializers.ValidationError('DOCX expanded content is too large.')
    finally:
        file_obj.seek(position)
    return file_obj


SAFE_ATTACHMENT_EXTENSIONS = {
    '.pdf', '.docx', '.xlsx', '.csv', '.txt',
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.mp4', '.mov', '.webm',
}


def _normalize_pseudo_base(value: str) -> str:
    ascii_value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    ascii_value = ascii_value.lower().strip()
    ascii_value = re.sub(r'[^a-z0-9._-]+', '.', ascii_value)
    return ascii_value.strip('._-')


def _pseudo_collision_key(value: str) -> str:
    return _normalize_pseudo_base(value or '')


def _pseudo_is_available(candidate: str, *, current_profile=None, reserved_username=None) -> bool:
    if not candidate:
        return False

    current_user_id = None
    current_username = reserved_username or ''
    current_value = ''
    if current_profile is not None:
        current_user_id = current_profile.user_id
        current_value = (current_profile.display_name or '').strip()
        current_username = current_profile.user.username

    if current_value and candidate.casefold() == current_value.casefold():
        return True

    candidate_key = _pseudo_collision_key(candidate)
    current_username_key = _pseudo_collision_key(current_username)

    duplicate_pseudo = InfluencerProfile.objects.exclude(
        pk=getattr(current_profile, 'pk', None)
    ).filter(display_name__iexact=candidate).exists()
    if not duplicate_pseudo:
        duplicate_pseudo = any(
            _pseudo_collision_key((profile.display_name or '').strip()) == candidate_key
            for profile in InfluencerProfile.objects.exclude(pk=getattr(current_profile, 'pk', None)).only('display_name')
            if (profile.display_name or '').strip()
        )
    if duplicate_pseudo:
        return False

    username_conflict = User.objects.exclude(pk=current_user_id).filter(username__iexact=candidate).exists()
    if not username_conflict:
        username_conflict = any(
            _pseudo_collision_key(user.username) == candidate_key
            for user in User.objects.exclude(pk=current_user_id).only('username')
            if user.username
        )
    if username_conflict and candidate_key != current_username_key:
        return False

    return True


def suggest_influencer_pseudos(value: str, *, current_profile=None, reserved_username=None, limit: int = 5) -> list[str]:
    cleaned = (value or '').strip()
    if not cleaned:
        return []

    base = _normalize_pseudo_base(cleaned)
    if not base:
        base = 'creator'

    current_username = reserved_username or ''
    if current_profile is not None:
        current_username = current_profile.user.username

    variants = [
        base,
        f'{base}1',
        f'{base}_official',
        f'{base}_creator',
        f'{base}.official',
        f'{base}.fr',
    ]
    suggestions: list[str] = []
    for candidate in variants:
        candidate = candidate.strip('._-')
        if not candidate:
            continue
        if not PSEUDO_REGEX.fullmatch(candidate):
            continue
        if current_profile is not None and candidate.casefold() == (current_profile.display_name or '').strip().casefold():
            continue
        if candidate.casefold() == (current_username or '').casefold():
            continue
        if _pseudo_is_available(candidate, current_profile=current_profile, reserved_username=reserved_username):
            if candidate not in suggestions:
                suggestions.append(candidate)
        if len(suggestions) >= limit:
            break
    return suggestions


def _generate_unique_referral_code() -> str:
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    for _ in range(50):
        code = ''.join(secrets.choice(alphabet) for _ in range(8))
        if not InfluencerProfile.objects.filter(referral_code=code).exists():
            return code
    return ''.join(secrets.choice(alphabet) for _ in range(10))


def _validate_influencer_pseudo(value, *, current_profile=None, reserved_username=None):
    cleaned = (value or '').strip()
    if not cleaned:
        return ''

    if current_profile is not None:
        current_value = (current_profile.display_name or '').strip()
        if current_value and cleaned.casefold() == current_value.casefold():
            return cleaned

    if not PSEUDO_REGEX.fullmatch(cleaned):
        raise serializers.ValidationError(
            'Pseudo can only contain letters, numbers, dots, hyphens, and underscores.'
        )

    if not _pseudo_is_available(cleaned, current_profile=current_profile, reserved_username=reserved_username):
        raise serializers.ValidationError('This pseudo is already taken.')

    return cleaned


# ---------------------------------------------------------------------------
# Influencer
# ---------------------------------------------------------------------------
class SocialNetworkSerializer(serializers.ModelSerializer):
    def validate_engagement_rate(self, value):
        # Engagement is a percentage and must stay within [0, 100].
        try:
            v = float(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("Engagement rate must be a number.")
        if v < 0 or v > 100:
            raise serializers.ValidationError("Engagement rate must be between 0 and 100.")
        return value

    def update(self, instance, validated_data):
        if instance.verified_via_api:
            for f in ("profile_url", "followers_count", "avg_views", "engagement_rate"):
                validated_data.pop(f, None)
        return super().update(instance, validated_data)

    class Meta:
        model = SocialNetwork
        fields = [
            'id', 'platform', 'profile_url', 'followers_count', 'avg_views',
            'engagement_rate', 'verified_via_api', 'last_synced_at',
            'external_user_id', 'external_username', 'display_name',
            'avatar_url', 'bio', 'is_verified_external',
            'video_count', 'total_likes', 'token_status',
        ]
        read_only_fields = [
            'verified_via_api', 'last_synced_at',
            'external_user_id', 'external_username', 'display_name',
            'avatar_url', 'bio', 'is_verified_external',
            'video_count', 'total_likes', 'token_status',
        ]


class SocialVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialVideo
        fields = [
            'id', 'external_video_id', 'caption', 'thumbnail_url', 'video_url',
            'view_count', 'like_count', 'comment_count', 'share_count',
            'duration_sec', 'published_at', 'fetched_at',
        ]


class SocialStatsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialStatsSnapshot
        fields = [
            'id', 'snapshot_date', 'followers_count', 'avg_views',
            'engagement_rate',
        ]


class SocialFraudFlagSerializer(serializers.ModelSerializer):
    social_network = serializers.IntegerField(source='social_network_id', read_only=True)
    platform = serializers.CharField(source='social_network.platform', read_only=True)
    external_username = serializers.CharField(source='social_network.external_username', read_only=True, default=None)
    influencer_pseudo = serializers.CharField(source='social_network.influencer.pseudo', read_only=True, default=None)
    influencer_id = serializers.IntegerField(source='social_network.influencer_id', read_only=True)

    class Meta:
        model = SocialFraudFlag
        fields = [
            'id', 'flag_type', 'severity', 'details',
            'created_at', 'resolved_at',
            'social_network', 'platform', 'external_username',
            'influencer_pseudo', 'influencer_id',
        ]


class CampaignVideoDailyStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampaignVideoDailyStats
        fields = [
            'id', 'snapshot_date', 'view_count', 'like_count',
            'comment_count', 'share_count', 'engagement_rate',
        ]


class CampaignVideoTrackingSerializer(serializers.ModelSerializer):
    daily_stats = CampaignVideoDailyStatsSerializer(many=True, read_only=True)
    latest_stats = serializers.SerializerMethodField()

    class Meta:
        model = CampaignVideoTracking
        fields = [
            'id', 'proposal', 'social_network', 'platform',
            'external_video_id', 'video_url', 'caption', 'thumbnail_url',
            'tracking_started_at', 'tracking_ends_at', 'is_frozen',
            'last_fetched_at', 'last_error',
            'daily_stats', 'latest_stats',
        ]
        read_only_fields = [
            'social_network', 'platform', 'external_video_id', 'caption',
            'thumbnail_url', 'tracking_started_at', 'tracking_ends_at',
            'is_frozen', 'last_fetched_at', 'last_error',
        ]

    def get_latest_stats(self, obj):
        latest = obj.daily_stats.order_by('-snapshot_date').first()
        if not latest:
            return None
        return CampaignVideoDailyStatsSerializer(latest).data


class InfluencerProfileSerializer(serializers.ModelSerializer):
    social_networks = SocialNetworkSerializer(many=True, read_only=True)
    media_kit_images = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    city = serializers.CharField(source='user.location', read_only=True)
    pseudo = serializers.SerializerMethodField()
    media_kit_pdf = serializers.SerializerMethodField()
    referral_code = serializers.CharField(read_only=True)
    referral_commission_discount_percent = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = InfluencerProfile
        fields = [
            'id', 'pseudo', 'bio', 'display_name', 'gender', 'collaboration_pitch', 'avatar', 'city', 'languages', 'content_themes',
            'content_types_offered', 'pricing', 'payment_method',
            'is_verified', 'is_ugc_creator', 'average_rating', 'social_networks',
            'onboarding_completed', 'profile_completion_percent',
            'media_kit_pdf', 'media_kit_generated_at', 'media_kit_is_custom', 'media_kit_images',
            'content_links',
            'stripe_account_id',
            'referral_code', 'referral_commission_discount_percent',
        ]
        read_only_fields = [
            'is_verified', 'average_rating',
            'profile_completion_percent', 'media_kit_pdf', 'media_kit_generated_at',
            'media_kit_is_custom',
            'stripe_account_id',
        ]

    def get_pseudo(self, obj):
        return (obj.display_name or '').strip() or obj.user.username

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        is_owner = bool(
            user and getattr(user, 'is_authenticated', False)
            and (user.is_staff or instance.user_id == user.id)
        )
        if not is_owner:
            # Private to the influencer — never shown to brands / partner API.
            for field in ('stripe_account_id', 'referral_code',
                          'referral_commission_discount_percent', 'payment_method'):
                data.pop(field, None)
        return data

    def validate_display_name(self, value):
        return _validate_influencer_pseudo(value, current_profile=self.instance)

    def validate_content_links(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("content_links must be a list.")
        cleaned = []
        for entry in value[:10]:  # cap to 10 entries
            if not isinstance(entry, dict):
                raise serializers.ValidationError("Each link must be an object {label, url}.")
            label = (entry.get('label') or '').strip()[:120]
            url = (entry.get('url') or '').strip()
            if not url:
                continue
            if not (url.startswith('http://') or url.startswith('https://')):
                raise serializers.ValidationError(f"URL must start with http:// or https:// — got '{url}'.")
            cleaned.append({"label": label, "url": url[:500]})
        return cleaned

    def get_media_kit_images(self, obj):
        request = self.context.get('request')
        result = []
        for img in obj.media_kit_images.all():
            url = img.image.url if img.image else None
            if request and url:
                url = request.build_absolute_uri(url)
            result.append({"id": img.id, "image": url, "caption": img.caption, "order": img.order})
        return result

    def get_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.user, 'avatar', None))

    def get_media_kit_pdf(self, obj):
        # Served through an authenticated endpoint: the raw /media/ URL would be
        # world-readable and enumerable.
        if not getattr(obj, 'media_kit_pdf', None):
            return None
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and getattr(user, 'is_authenticated', False)):
            return None
        url = reverse('influencer-media-kit-download', kwargs={'pk': obj.pk})
        return request.build_absolute_uri(url) if request else url


class MediaKitImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaKitImage
        fields = ['id', 'image', 'caption', 'order', 'created_at']
        read_only_fields = ['id', 'created_at']


class InfluencerProfileWithPaymentSerializer(InfluencerProfileSerializer):
    payment_details = serializers.SerializerMethodField()

    class Meta(InfluencerProfileSerializer.Meta):
        fields = InfluencerProfileSerializer.Meta.fields + ['payment_details']

    def get_payment_details(self, obj):
        return decrypt_value(obj.payment_details)

    def update(self, instance, validated_data):
        if 'payment_details' in self.initial_data:
            raw = self.initial_data['payment_details']
            instance.payment_details = encrypt_value(raw)
        return super().update(instance, validated_data)


# ---------------------------------------------------------------------------
# Brand
# ---------------------------------------------------------------------------
class BrandProfileSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()
    logo_upload = serializers.ImageField(source='logo', write_only=True, required=False, allow_null=True)

    class Meta:
        model = BrandProfile
        fields = [
            'id', 'company_name', 'siret', 'logo', 'logo_upload', 'sector', 'description',
            'website', 'billing_address', 'billing_postal_code', 'billing_city', 'billing_country',
            'subscription_plan', 'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
            'is_agency', 'agency_default_commission_percent',
        ]
        read_only_fields = [
            'subscription_plan',
            'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
            'is_agency', 'agency_default_commission_percent',
        ]

    def get_logo(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj, 'logo', None))

    def validate_siret(self, value):
        # A SIRET is exactly 14 digits; spaces are common when copy-pasted.
        cleaned = re.sub(r'\s+', '', value or '')
        if not cleaned:
            return ''
        if not cleaned.isdigit() or len(cleaned) != 14:
            raise serializers.ValidationError(
                'Le SIRET doit contenir exactement 14 chiffres.'
            )
        return cleaned

    def validate_billing_postal_code(self, value):
        cleaned = re.sub(r'\s+', '', value or '')
        if not cleaned:
            return ''
        # Keep this permissive enough for non-French codes while catching typos.
        if not re.fullmatch(r'[A-Za-z0-9\-]{4,10}', cleaned):
            raise serializers.ValidationError('Code postal invalide.')
        return cleaned.upper()

    def validate_billing_city(self, value):
        cleaned = (value or '').strip()
        if cleaned and len(cleaned) < 2:
            raise serializers.ValidationError('Ville invalide.')
        return cleaned

    def validate_billing_country(self, value):
        cleaned = (value or '').strip().upper()
        if cleaned and not re.fullmatch(r'[A-Z]{2}', cleaned):
            raise serializers.ValidationError('Utilisez un code pays ISO à 2 lettres (ex. FR).')
        return cleaned


class BrandPublicSerializer(serializers.ModelSerializer):
    logo = serializers.SerializerMethodField()

    class Meta:
        model = BrandProfile
        fields = [
            'id', 'company_name', 'logo', 'sector', 'description', 'website',
            'average_rating', 'is_agency',
        ]

    def get_logo(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj, 'logo', None))


class BrandAdminSerializer(serializers.ModelSerializer):
    """Full brand view for admins (with Stripe ids and validator info)."""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_name = serializers.SerializerMethodField()
    validated_by_username = serializers.CharField(source='validated_by.username', read_only=True)
    created_at = serializers.DateTimeField(source='user.created_at', read_only=True)
    logo = serializers.SerializerMethodField()

    class Meta:
        model = BrandProfile
        fields = [
            'id', 'user_id', 'user_email', 'user_name', 'company_name', 'siret',
            'sector', 'description', 'logo',
            'website', 'billing_address',
            'subscription_plan', 'subscription_active', 'subscription_expires_at',
            'subscription_price_override',
            'stripe_customer_id', 'stripe_subscription_id',
            'validation_status', 'validation_notes', 'validated_at',
            'validated_by_username', 'created_at',
        ]

    def get_user_name(self, obj):
        u = obj.user
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username

    def get_logo(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj, 'logo', None))


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    # Write-only upload field — accepts a file upload.
    avatar_upload = serializers.ImageField(source='avatar', write_only=True, required=False, allow_null=True)
    # Read-only display field — returns an absolute URL.
    avatar = serializers.SerializerMethodField()
    sso_enabled = serializers.SerializerMethodField()
    influencer_profile = InfluencerProfileSerializer(read_only=True)
    brand_profile = BrandProfileSerializer(read_only=True)
    brand_environments = serializers.SerializerMethodField()
    active_brand_workspace_id = serializers.IntegerField(read_only=True)
    active_brand_role = serializers.SerializerMethodField()
    active_brand = serializers.SerializerMethodField()
    platform_features = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'auth_provider', 'sso_enabled', 'language_preference', 'avatar', 'avatar_upload', 'phone', 'location',
            'totp_enabled', 'email_2fa_enabled', 'email_verified',
            'created_at', 'updated_at', 'influencer_profile', 'brand_profile',
            'brand_environments', 'active_brand_workspace_id', 'active_brand_role', 'active_brand',
            'platform_features',
        ]
        # email_verified must never be writable: it is set only by consuming
        # a signed one-time link.
        read_only_fields = [
            'user_type', 'auth_provider', 'sso_enabled', 'created_at', 'updated_at',
            'totp_enabled', 'email_2fa_enabled', 'email_verified',
        ]

    def update(self, instance, validated_data):
        # A new address has not been proven yet: re-verify it.
        new_email = validated_data.get('email')
        if new_email and new_email.lower() != (instance.email or '').lower():
            validated_data['email_verified'] = False
            validated_data['email_verified_at'] = None
        return super().update(instance, validated_data)

    def validate_email(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Email is required.')
        existing = User.objects.exclude(pk=getattr(self.instance, 'pk', None)).filter(email__iexact=value).exists()
        if existing:
            raise serializers.ValidationError('Email already registered.')
        return value

    def get_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj, 'avatar', None))

    def get_sso_enabled(self, obj):
        return bool(getattr(obj, 'is_sso_account', False))

    def get_brand_environments(self, obj):
        if not getattr(obj, 'is_authenticated', False):
            return []
        workspaces = get_user_brand_workspaces(obj).select_related('user')
        payload = []
        for brand in workspaces:
            payload.append({
                'id': brand.id,
                'company_name': brand.company_name,
                'is_agency': bool(brand.is_agency),
                'role': get_user_role_for_brand(obj, brand),
            })
        return payload

    def get_active_brand_role(self, obj):
        if not obj.active_brand_workspace_id:
            return None
        return get_user_role_for_brand(obj, getattr(obj, 'active_brand_workspace', None))

    def get_active_brand(self, obj):
        brand = getattr(obj, 'active_brand_workspace', None)
        if not brand:
            return None
        from .services import plans as plans_service
        return {
            'id': brand.id,
            'company_name': brand.company_name,
            'is_agency': bool(brand.is_agency),
            'validation_status': brand.validation_status,
            'subscription_plan': brand.subscription_plan,
            'subscription_active': bool(brand.subscription_active),
            # Entitlements of the current plan — drives frontend feature gating
            'plan_features': plans_service.get_brand_features(brand),
            'plan_price_eur_monthly': plans_service.get_brand_price(brand),
        }

    def get_platform_features(self, obj):
        from .services import plans as plans_service

        return {
            key: plans_service.is_platform_feature_enabled(key)
            for key in plans_service.PLATFORM_FEATURE_FIELDS
        }


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False, default='')
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    user_type = serializers.ChoiceField(choices=['influencer', 'brand'])
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')
    # Brand-specific (CDC §5.1)
    company_name = serializers.CharField(max_length=200, required=False, default='', allow_blank=True)
    siret = serializers.CharField(max_length=20, required=False, default='', allow_blank=True)
    website = serializers.URLField(required=False, default='', allow_blank=True)
    sector = serializers.CharField(max_length=100, required=False, default='', allow_blank=True)
    subscription_plan = serializers.ChoiceField(
        choices=['starter', 'growth', 'pro'], required=False, allow_null=True, allow_blank=True,
    )
    is_agency = serializers.BooleanField(required=False, default=False)
    # Influencer-specific
    display_name = serializers.CharField(max_length=100, required=False, default='')
    is_ugc_creator = serializers.BooleanField(required=False, default=False)
    referral_code = serializers.CharField(max_length=20, required=False, default='', allow_blank=True)
    # Sent by the frontend so transactional emails match the language the user
    # signed up in; without it every account silently fell back to English.
    language_preference = serializers.ChoiceField(
        choices=['fr', 'en'], required=False, allow_blank=True, default='fr',
    )

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already registered.')
        return value

    def validate(self, attrs):
        if attrs.get('is_agency') and attrs.get('user_type') != 'brand':
            raise serializers.ValidationError({'is_agency': 'Only brand accounts can be agencies.'})
        if attrs['user_type'] == 'brand':
            if not attrs.get('company_name'):
                raise serializers.ValidationError({'company_name': 'Required for brand registration.'})
            # No plan required at signup: brands are free until they contract a
            # collaboration, where the subscription paywall kicks in.
            if attrs.get('is_agency') and attrs.get('subscription_plan') == 'starter':
                raise serializers.ValidationError({'subscription_plan': 'Agency accounts require Growth or Pro.'})
        if not attrs.get('username'):
            base = attrs['email'].split('@')[0]
            username = base
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base}{counter}"
                counter += 1
            attrs['username'] = username
        elif User.objects.filter(username=attrs['username']).exists():
            raise serializers.ValidationError({'username': 'Username already taken.'})
        admin_username = (os.getenv('ADMIN_USERNAME') or 'admin').strip().lower()
        if attrs['username'].strip().lower() == admin_username:
            raise serializers.ValidationError({'username': 'This username is reserved.'})
        if attrs.get('user_type') == 'influencer':
            try:
                attrs['display_name'] = _validate_influencer_pseudo(
                    attrs.get('display_name', ''),
                    reserved_username=attrs['username'],
                )
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'display_name': exc.detail})
            referral_code = (attrs.get('referral_code') or '').strip().upper()
            if referral_code:
                from .services import plans as plans_service

                if not plans_service.is_platform_feature_enabled('referral_program'):
                    raise serializers.ValidationError({'referral_code': 'The referral program is currently unavailable.'})
                referrer = InfluencerProfile.objects.filter(referral_code=referral_code).select_related('user').first()
                if not referrer:
                    raise serializers.ValidationError({'referral_code': 'Invalid referral code.'})
                attrs['_referrer_profile'] = referrer
                attrs['referral_code'] = referral_code
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            user_type=validated_data['user_type'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            language_preference=(validated_data.get('language_preference') or 'fr'),
        )
        if user.user_type == 'influencer':
            profile = InfluencerProfile.objects.create(
                user=user,
                display_name=validated_data.get('display_name', ''),
                is_ugc_creator=bool(validated_data.get('is_ugc_creator', False)),
                referral_code=_generate_unique_referral_code(),
            )
            referrer = validated_data.get('_referrer_profile')
            if referrer and referrer.user_id != user.id:
                discount = PlatformSettings.get_instance().referral_commission_discount_percent
                profile.referred_by = referrer
                profile.referral_code_used_at = timezone.now()
                profile.referral_commission_discount_percent = discount
                profile.save(update_fields=['referred_by', 'referral_code_used_at', 'referral_commission_discount_percent'])

                if referrer.referral_commission_discount_percent < discount:
                    referrer.referral_commission_discount_percent = discount
                    referrer.save(update_fields=['referral_commission_discount_percent'])

                InfluencerReferralInvite.objects.filter(
                    inviter=referrer,
                    invited_email__iexact=user.email,
                    status='sent',
                ).update(
                    status='accepted',
                    accepted_by=profile,
                    accepted_at=timezone.now(),
                )
        elif user.user_type == 'brand':
            # validation_status defaults to 'pending' — admin must approve
            brand_profile = BrandProfile.objects.create(
                user=user,
                company_name=validated_data['company_name'],
                siret=validated_data.get('siret', ''),
                website=validated_data.get('website', ''),
                sector=validated_data.get('sector', ''),
                subscription_plan=validated_data.get('subscription_plan') or '',
                is_agency=bool(validated_data.get('is_agency', False)),
            )
            user.active_brand_workspace = brand_profile
            user.save(update_fields=['active_brand_workspace'])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username_or_email = (attrs.get('username') or '').strip()
        password = attrs['password']
        if not username_or_email:
            raise serializers.ValidationError('Invalid credentials.')

        user = authenticate(username=username_or_email, password=password)
        if not user:
            account = User.objects.filter(
                Q(email__iexact=username_or_email) | Q(username__iexact=username_or_email)
            ).only('username').first()
            if account:
                user = authenticate(username=account.username, password=password)
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        if user.user_type in ('brand', 'admin'):
            from .services import sso_office365

            sso = sso_office365.resolve_sso_config_by_email(user.email or '')
            if sso and sso.enforce_sso:
                role = get_user_role_for_brand(user, sso.brand)
                owner_fallback = sso.allow_local_fallback_for_owner and role == 'owner'
                if not owner_fallback:
                    raise serializers.ValidationError('Password login is disabled. Use your organization SSO.')
        attrs['user'] = user
        return attrs


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------
class CampaignDocumentSerializer(serializers.ModelSerializer):
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = CampaignDocument
        fields = ['id', 'campaign', 'file', 'file_name', 'label', 'created_at']
        read_only_fields = ['id', 'campaign', 'created_at']

    def get_file_name(self, obj):
        return obj.file.name.rsplit('/', 1)[-1] if obj.file else ''

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        url = reverse('campaign-document-download', kwargs={'document_id': instance.pk})
        data['file'] = request.build_absolute_uri(url) if request else url
        return data

    def validate_file(self, value):
        return validate_uploaded_file(
            value, max_bytes=10 * 1024 * 1024,
            extensions={'.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp'},
        )


class CampaignSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.company_name', read_only=True)
    brand_logo = serializers.SerializerMethodField()
    documents = CampaignDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Campaign
        fields = [
            'id', 'brand', 'brand_name', 'brand_logo', 'title', 'description', 'campaign_type',
            'status', 'products', 'shipping_info', 'deliverables_requested',
            'brief_text', 'brief_files', 'documents', 'target_networks', 'content_format', 'content_formats',
            'price_per_influencer', 'deadline', 'target_filters',
            'is_casting', 'casting_criteria', 'is_ugc', 'max_influencers', 'image_rights', 'contract_template',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['brand', 'created_at', 'updated_at']

    def get_brand_logo(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.brand, 'logo', None))

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.brief_files:
            request = self.context.get('request')
            url = reverse('campaign-brief-file', kwargs={'pk': instance.pk})
            data['brief_files'] = request.build_absolute_uri(url) if request else url
        else:
            data['brief_files'] = None
        return data

    def validate_brief_files(self, value):
        return validate_uploaded_file(
            value, max_bytes=25 * 1024 * 1024,
            extensions=SAFE_ATTACHMENT_EXTENSIONS,
        )


class EventInvitationSerializer(serializers.ModelSerializer):
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)
    influencer_user_id = serializers.IntegerField(source='influencer.user_id', read_only=True)
    influencer_avatar = serializers.SerializerMethodField()
    invitee_label = serializers.SerializerMethodField()
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_address = serializers.CharField(source='event.address', read_only=True)
    event_city = serializers.CharField(source='event.city', read_only=True)
    event_starts_at = serializers.DateTimeField(source='event.starts_at', read_only=True)
    event_ends_at = serializers.DateTimeField(source='event.ends_at', read_only=True)
    qr_payload = serializers.SerializerMethodField()

    class Meta:
        model = EventInvitation
        fields = [
            'id', 'event', 'event_title', 'event_address', 'event_city', 'event_starts_at', 'event_ends_at',
            'influencer', 'influencer_user_id', 'influencer_display_name', 'influencer_avatar',
            'invited_email', 'invitee_label',
            'invite_token', 'status', 'max_plus_ones', 'plus_ones_confirmed', 'response_message',
            'responded_at', 'checked_in_at', 'checked_in_by', 'created_at', 'updated_at', 'qr_payload',
        ]
        read_only_fields = [
            'responded_at', 'checked_in_at', 'checked_in_by', 'created_at', 'updated_at',
            'invite_token', 'influencer_avatar', 'qr_payload',
        ]

    def get_influencer_avatar(self, obj):
        if not obj.influencer_id:
            return None
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.influencer.user, 'avatar', None))

    def get_invitee_label(self, obj):
        if obj.influencer_id:
            return (obj.influencer.display_name or '').strip() or obj.influencer.user.username
        return obj.invited_email

    def get_qr_payload(self, obj):
        return f"IC-EVT:{obj.event_id}:{obj.invite_token}"


class EventSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.company_name', read_only=True)
    invitations = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            'id', 'brand', 'brand_name', 'title', 'description', 'address', 'city',
            'starts_at', 'ends_at', 'status', 'max_invitees', 'invitations', 'created_at', 'updated_at',
        ]
        read_only_fields = ['brand', 'created_at', 'updated_at']

    def get_invitations(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        invitations = obj.invitations.all()
        if not user or not getattr(user, 'is_authenticated', False):
            return []
        if user.user_type == 'influencer':
            invitations = invitations.filter(influencer__user=user)
        elif user.user_type == 'brand':
            if not user_can_access_brand(user, obj.brand):
                return []
        elif not user.is_staff:
            return []
        return EventInvitationSerializer(invitations, many=True, context=self.context).data


class ContractTemplateSerializer(serializers.ModelSerializer):
    source_file_url = serializers.SerializerMethodField()

    class Meta:
        model = ContractTemplate
        fields = ['id', 'name', 'description', 'body_html', 'source_file', 'source_file_url', 'is_default', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'source_file_url']
        extra_kwargs = {'source_file': {'required': False, 'allow_null': True}}

    def get_source_file_url(self, obj):
        if not obj.source_file:
            return None
        request = self.context.get('request')
        url = reverse('contract-template-source-file', kwargs={'pk': obj.pk})
        return request.build_absolute_uri(url) if request else url

    def validate_body_html(self, value):
        cleaned = sanitize_contract_html(value)
        if not cleaned.strip():
            raise serializers.ValidationError('Contract content cannot be empty.')
        return cleaned

    def validate_source_file(self, value):
        return validate_contract_source(value)


# ---------------------------------------------------------------------------
# Proposal
# ---------------------------------------------------------------------------
class CampaignProposalSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    campaign_description = serializers.CharField(source='campaign.description', read_only=True)
    campaign_target_networks = serializers.ListField(source='campaign.target_networks', read_only=True)
    campaign_target_filters = serializers.DictField(source='campaign.target_filters', read_only=True)
    campaign_content_formats = serializers.ListField(source='campaign.content_formats', read_only=True)
    campaign_status = serializers.CharField(source='campaign.status', read_only=True)
    campaign_deadline = serializers.DateField(source='campaign.deadline', read_only=True)
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)
    influencer_pseudo = serializers.SerializerMethodField()
    influencer_avatar = serializers.SerializerMethodField()
    brand_company_name = serializers.CharField(source='campaign.brand.company_name', read_only=True)
    brand_id = serializers.IntegerField(source='campaign.brand.id', read_only=True)
    latest_submission_kind = serializers.SerializerMethodField()
    latest_submission_pre_publish = serializers.SerializerMethodField()
    latest_submission_rejection_reason = serializers.SerializerMethodField()
    latest_submission_rejection_comment = serializers.SerializerMethodField()

    class Meta:
        model = CampaignProposal
        fields = [
            'id', 'campaign', 'campaign_title', 'campaign_description',
            'campaign_target_networks', 'campaign_target_filters', 'campaign_content_formats',
            'campaign_status', 'campaign_deadline',
            'influencer', 'influencer_display_name', 'influencer_pseudo', 'influencer_avatar',
            'brand_company_name', 'brand_id', 'status', 'proposed_price', 'counter_price',
            'counter_message', 'decline_reason',
            'contract_template',
            'contract_pdf', 'contract_version',
            'contract_signed_brand', 'contract_signed_influencer', 'contract_signed_at',
            'brand_signed_at', 'influencer_signed_at',
            'escrow_amount', 'escrow_funded', 'escrow_released',
            'escrow_funded_at', 'escrow_released_at',
            'submission_deadline', 'validation_deadline',
            'latest_submission_kind', 'latest_submission_pre_publish',
            'latest_submission_rejection_reason', 'latest_submission_rejection_comment',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'status', 'contract_pdf', 'contract_version',
            'contract_signed_brand', 'contract_signed_influencer', 'contract_signed_at',
            'brand_signed_at', 'influencer_signed_at',
            'escrow_funded', 'escrow_released', 'escrow_funded_at', 'escrow_released_at',
            'submission_deadline', 'validation_deadline',
            'created_at', 'updated_at',
        ]

    def get_influencer_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.influencer.user, 'avatar', None))

    def get_influencer_pseudo(self, obj):
        return (obj.influencer.display_name or '').strip() or obj.influencer.user.username

    def _latest_submission(self, obj):
        # Called by 4 method fields — memoize per instance, and reuse the
        # newest-first prefetch when the view provides one (list endpoints).
        if not hasattr(obj, '_latest_submission_cache'):
            prefetched = getattr(obj, '_prefetched_objects_cache', {}).get('submissions')
            if prefetched is not None:
                obj._latest_submission_cache = prefetched[0] if len(prefetched) else None
            else:
                obj._latest_submission_cache = obj.submissions.order_by('-created_at').first()
        return obj._latest_submission_cache

    def get_latest_submission_kind(self, obj):
        submission = self._latest_submission(obj)
        if not submission:
            return None
        if submission.submission_type == 'link':
            return 'link'

        file_name = (getattr(submission.uploaded_file, 'name', '') or '').lower()
        if any(file_name.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
            return 'photo'
        if any(file_name.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']):
            return 'video'
        return 'upload'

    def get_latest_submission_pre_publish(self, obj):
        submission = self._latest_submission(obj)
        if not submission:
            return None
        return not bool(submission.publication_url)

    def get_latest_submission_rejection_reason(self, obj):
        submission = self._latest_submission(obj)
        if not submission:
            return None
        return submission.rejection_reason or None

    def get_latest_submission_rejection_comment(self, obj):
        submission = self._latest_submission(obj)
        if not submission:
            return None
        return submission.rejection_comment or None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.contract_pdf:
            url = reverse('proposal-contract-download', kwargs={'pk': instance.id})
            data['contract_pdf'] = request.build_absolute_uri(url) if request else url
        else:
            data['contract_pdf'] = None
        return data


class ContentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentSubmission
        fields = [
            'id', 'proposal', 'submission_type', 'publication_url', 'uploaded_file',
            'screenshot', 'publication_date', 'initial_stats', 'final_stats',
            'brand_validated', 'brand_validation_date', 'rejection_reason',
            'rejection_comment', 'correction_requested', 'correction_deadline',
            'admin_validated', 'admin_notes', 'created_at',
        ]
        read_only_fields = [
            'brand_validated', 'brand_validation_date', 'rejection_reason',
            'rejection_comment', 'correction_requested', 'correction_deadline',
            'admin_validated', 'admin_notes', 'created_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.uploaded_file:
            url = reverse('proposal-submission-asset', kwargs={'submission_id': instance.id, 'asset': 'uploaded_file'})
            data['uploaded_file'] = request.build_absolute_uri(url) if request else url
        else:
            data['uploaded_file'] = None

        if instance.screenshot:
            url = reverse('proposal-submission-asset', kwargs={'submission_id': instance.id, 'asset': 'screenshot'})
            data['screenshot'] = request.build_absolute_uri(url) if request else url
        else:
            data['screenshot'] = None
        return data

    def validate_uploaded_file(self, value):
        return validate_uploaded_file(
            value, max_bytes=100 * 1024 * 1024,
            extensions={'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm'},
        )

    def validate_screenshot(self, value):
        return validate_uploaded_file(
            value, max_bytes=10 * 1024 * 1024,
            extensions={'.jpg', '.jpeg', '.png', '.gif', '.webp'},
        )


# ---------------------------------------------------------------------------
# Message / Review / Notification
# ---------------------------------------------------------------------------
class MessageSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'proposal', 'sender', 'sender_username', 'sender_avatar', 'content',
                  'attachments', 'read', 'created_at']
        read_only_fields = ['sender', 'read', 'created_at']

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.sender, 'avatar', None))

    def validate_attachments(self, value):
        return validate_uploaded_file(
            value, max_bytes=25 * 1024 * 1024,
            extensions=SAFE_ATTACHMENT_EXTENSIONS,
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['content'] = _decrypt_message_text(instance.content)
        request = self.context.get('request')
        if instance.attachments:
            url = reverse('proposal-message-attachment', kwargs={'message_id': instance.id})
            data['attachments'] = request.build_absolute_uri(url) if request else url
        else:
            data['attachments'] = None
        return data


class DirectMessageSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True)
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar = serializers.SerializerMethodField()
    recipient_username = serializers.CharField(source='recipient.username', read_only=True)

    class Meta:
        model = DirectMessage
        fields = ['id', 'sender', 'sender_username', 'sender_avatar', 'recipient', 
                  'recipient_username', 'content', 'attachments', 'read', 'created_at']
        read_only_fields = ['sender', 'read', 'created_at']

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.sender, 'avatar', None))

    def validate_attachments(self, value):
        return validate_uploaded_file(
            value, max_bytes=25 * 1024 * 1024,
            extensions=SAFE_ATTACHMENT_EXTENSIONS,
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['content'] = _decrypt_message_text(instance.content)
        request = self.context.get('request')
        if instance.attachments:
            url = reverse('direct-message-attachment', kwargs={'message_id': instance.id})
            data['attachments'] = request.build_absolute_uri(url) if request else url
        else:
            data['attachments'] = None
        return data


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    reviewee_username = serializers.CharField(source='reviewee.username', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'proposal', 'reviewer', 'reviewer_username',
            'reviewee', 'reviewee_username', 'rating', 'criteria_ratings',
            'comment', 'is_published', 'created_at',
        ]
        read_only_fields = ['reviewer', 'is_published', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'related_proposal', 'read', 'email_sent', 'created_at',
        ]
        read_only_fields = ['notification_type', 'title', 'message',
                            'related_proposal', 'email_sent', 'created_at']


class SupportTicketImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketImage
        fields = ['id', 'image_url', 'uploaded_at']

    def get_image_url(self, obj):
        request = self.context.get('request')
        url = reverse('support-ticket-image-download', kwargs={'image_id': obj.id})
        return request.build_absolute_uri(url) if request else url


def _support_requester_kind(user: User) -> str:
    if user.user_type != 'brand':
        return user.user_type
    brand = getattr(user, 'brand_profile', None)
    if brand and getattr(brand, 'is_agency', False):
        return 'agency'
    return 'brand'


def _support_requester_display_name(user: User) -> str:
    if user.user_type == 'influencer' and hasattr(user, 'influencer_profile'):
        profile = user.influencer_profile
        return (profile.display_name or '').strip() or user.get_full_name().strip() or user.username
    if user.user_type == 'brand' and hasattr(user, 'brand_profile'):
        return user.brand_profile.company_name or user.get_full_name().strip() or user.username
    return user.get_full_name().strip() or user.username


def _translate_support_ticket_payload(data: dict, source_lang: str, target_lang: str) -> dict:
    source = (source_lang or '').strip().upper()
    target = (target_lang or '').strip().upper()
    if not source or not target or source == target:
        return data
    data = dict(data)
    data['subject'] = _translate(data.get('subject', ''), target)
    data['message'] = _translate(data.get('message', ''), target)
    if data.get('admin_reply'):
        data['admin_reply'] = _translate(data['admin_reply'], target)
    return data


class SupportTicketSerializer(serializers.ModelSerializer):
    """Serializer for users — admin_note (internal) is NOT exposed."""
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    images = SupportTicketImageSerializer(many=True, read_only=True)
    requester_kind = serializers.SerializerMethodField()
    requester_display_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'requester', 'requester_email', 'requester_kind', 'requester_display_name', 'source_language',
            'subject', 'message', 'status', 'priority',
            'admin_reply',
            'images',
            'rating', 'rated_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'requester', 'requester_email', 'requester_kind', 'requester_display_name', 'source_language',
            'status', 'admin_reply', 'images', 'rating', 'rated_at', 'created_at', 'updated_at',
        ]

    def get_requester_kind(self, obj):
        return _support_requester_kind(obj.requester)

    def get_requester_display_name(self, obj):
        return _support_requester_display_name(obj.requester)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        target_lang = self.context.get('translate_to', '')
        return _translate_support_ticket_payload(data, getattr(instance, 'source_language', ''), target_lang)


class SupportTicketAdminUpdateSerializer(serializers.ModelSerializer):
    """Serializer for admins — exposes both admin_reply (public) and admin_note (internal)."""
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    images = SupportTicketImageSerializer(many=True, read_only=True)
    requester_kind = serializers.SerializerMethodField()
    requester_display_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'requester', 'requester_email', 'requester_kind', 'requester_display_name', 'source_language',
            'subject', 'message', 'status', 'priority',
            'admin_reply', 'admin_note',
            'images',
            'rating', 'rated_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['requester', 'requester_email', 'requester_kind', 'requester_display_name', 'source_language', 'subject', 'message', 'images', 'rating', 'rated_at', 'created_at', 'updated_at']

    def get_requester_kind(self, obj):
        return _support_requester_kind(obj.requester)

    def get_requester_display_name(self, obj):
        return _support_requester_display_name(obj.requester)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        target_lang = self.context.get('translate_to', '')
        return _translate_support_ticket_payload(data, getattr(instance, 'source_language', ''), target_lang)


# ---------------------------------------------------------------------------
# Casting / Ambassador / AuditLog / Settings
# ---------------------------------------------------------------------------
class CastingApplicationSerializer(serializers.ModelSerializer):
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)
    influencer_pseudo = serializers.SerializerMethodField()
    influencer_avatar = serializers.SerializerMethodField()
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)

    class Meta:
        model = CastingApplication
        fields = [
            'id', 'campaign', 'campaign_title', 'influencer', 'influencer_display_name',
            'influencer_pseudo', 'influencer_avatar',
            'motivation', 'examples', 'status', 'created_at', 'decided_at',
        ]
        read_only_fields = ['status', 'created_at', 'decided_at']

    def get_influencer_avatar(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.influencer.user, 'avatar', None))

    def get_influencer_pseudo(self, obj):
        return (obj.influencer.display_name or '').strip() or obj.influencer.user.username


class AmbassadorProgramSerializer(serializers.ModelSerializer):
    brand_company_name = serializers.CharField(source='brand.company_name', read_only=True)
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)

    class Meta:
        model = AmbassadorProgram
        fields = [
            'id', 'brand', 'brand_company_name', 'influencer', 'influencer_display_name',
            'name', 'description', 'monthly_budget', 'kpis', 'bonus_rules',
            'status', 'starts_at', 'ends_at', 'auto_renew', 'created_at',
        ]
        read_only_fields = ['brand', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source='actor.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_username', 'action', 'target_type', 'target_id',
            'metadata', 'ip_address', 'created_at',
        ]


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = [
            'commission_rate', 'referral_commission_discount_percent',
            'annual_discount_percent',
            'validation_deadline_days', 'dispute_resolution_hours',
            'ambassador_programs_enabled', 'events_enabled',
            'referral_program_enabled',
        ]

    def validate_commission_rate(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Commission rate must be between 0 and 100.')
        return value

    def validate_annual_discount_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Annual discount must be between 0 and 100.')
        return value

    def validate_referral_commission_discount_percent(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Referral discount must be between 0 and 100.')
        return value

    def validate_validation_deadline_days(self, value):
        if value < 1 or value > 30:
            raise serializers.ValidationError('Validation deadline must be between 1 and 30 days.')
        return value

    def validate_dispute_resolution_hours(self, value):
        if value < 1 or value > 720:
            raise serializers.ValidationError('Dispute resolution must be between 1 and 720 hours.')
        return value


# ---------------------------------------------------------------------------
# Multi-user enterprise & Agency delegation
# ---------------------------------------------------------------------------
class BrandMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = BrandMembership
        fields = ['id', 'brand', 'user', 'user_email', 'user_name', 'invited_email',
                  'role', 'status', 'invited_at', 'joined_at']
        read_only_fields = ['brand', 'user', 'invited_email', 'status', 'invited_at', 'joined_at']

    def get_user_name(self, obj):
        if not obj.user_id:
            return ''
        u = obj.user
        return (f'{u.first_name} {u.last_name}'.strip()) or u.username


class AgencyDelegationSerializer(serializers.ModelSerializer):
    influencer_name = serializers.SerializerMethodField()
    agency_name = serializers.CharField(source='agency.company_name', read_only=True)

    class Meta:
        model = AgencyDelegation
        fields = ['id', 'agency', 'agency_name', 'influencer', 'influencer_name',
                  'commission_percent', 'status', 'invitation_message',
                  'created_at', 'accepted_at', 'revoked_at']
        read_only_fields = ['agency', 'status', 'created_at', 'accepted_at', 'revoked_at']

    def get_influencer_name(self, obj):
        u = obj.influencer.user
        return (f'{u.first_name} {u.last_name}'.strip()) or u.username
