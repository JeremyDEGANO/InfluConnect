from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import serializers
from cryptography.fernet import Fernet, InvalidToken
import base64
import hashlib
import re
import unicodedata

from .services.translation_service import translate as _translate

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile,
    Campaign, CampaignProposal, ContentSubmission,
    Message, Review, Notification, PlatformSettings,
    ContractTemplate, CastingApplication, AmbassadorProgram, AuditLog,
    MediaKitImage, BrandMembership, AgencyDelegation, SupportTicket,
    SupportTicketImage, TranslationCache,
)


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
    current_value_key = _pseudo_collision_key(current_value)
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

    class Meta:
        model = SocialNetwork
        fields = [
            'id', 'platform', 'profile_url', 'followers_count', 'avg_views',
            'engagement_rate', 'verified_via_api', 'last_synced_at',
        ]
        read_only_fields = ['verified_via_api', 'last_synced_at']


class InfluencerProfileSerializer(serializers.ModelSerializer):
    social_networks = SocialNetworkSerializer(many=True, read_only=True)
    media_kit_images = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    city = serializers.CharField(source='user.location', read_only=True)
    pseudo = serializers.SerializerMethodField()
    media_kit_pdf = serializers.SerializerMethodField()

    class Meta:
        model = InfluencerProfile
        fields = [
            'id', 'pseudo', 'bio', 'display_name', 'gender', 'collaboration_pitch', 'avatar', 'city', 'languages', 'content_themes',
            'content_types_offered', 'pricing', 'payment_method',
            'is_verified', 'average_rating', 'social_networks',
            'onboarding_completed', 'profile_completion_percent',
            'media_kit_pdf', 'media_kit_generated_at', 'media_kit_is_custom', 'media_kit_images',
            'content_links',
            'stripe_account_id',
        ]
        read_only_fields = [
            'is_verified', 'average_rating',
            'profile_completion_percent', 'media_kit_pdf', 'media_kit_generated_at',
            'media_kit_is_custom',
            'stripe_account_id',
        ]

    def get_pseudo(self, obj):
        return (obj.display_name or '').strip() or obj.user.username

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
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj, 'media_kit_pdf', None))


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
            'website', 'billing_address',
            'subscription_plan', 'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
            'is_agency', 'agency_default_commission_percent',
        ]
        read_only_fields = [
            'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
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

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'auth_provider', 'sso_enabled', 'language_preference', 'avatar', 'avatar_upload', 'phone', 'location',
            'totp_enabled', 'email_2fa_enabled',
            'created_at', 'updated_at', 'influencer_profile', 'brand_profile',
        ]
        read_only_fields = ['user_type', 'auth_provider', 'sso_enabled', 'created_at', 'updated_at', 'totp_enabled', 'email_2fa_enabled']

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
            # CDC §5.1 — choosing a subscription plan is mandatory for brands
            if not attrs.get('subscription_plan'):
                raise serializers.ValidationError({'subscription_plan': 'Required for brand registration.'})
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
        if attrs.get('user_type') == 'influencer':
            try:
                attrs['display_name'] = _validate_influencer_pseudo(
                    attrs.get('display_name', ''),
                    reserved_username=attrs['username'],
                )
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({'display_name': exc.detail})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            user_type=validated_data['user_type'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        if user.user_type == 'influencer':
            InfluencerProfile.objects.create(
                user=user,
                display_name=validated_data.get('display_name', ''),
            )
        elif user.user_type == 'brand':
            # validation_status defaults to 'pending' — admin must approve
            BrandProfile.objects.create(
                user=user,
                company_name=validated_data['company_name'],
                siret=validated_data.get('siret', ''),
                website=validated_data.get('website', ''),
                sector=validated_data.get('sector', ''),
                subscription_plan=validated_data.get('subscription_plan'),
                is_agency=bool(validated_data.get('is_agency', False)),
            )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username_or_email = attrs['username']
        password = attrs['password']
        user = authenticate(username=username_or_email, password=password)
        if not user:
            try:
                email_user = User.objects.get(email=username_or_email)
                user = authenticate(username=email_user.username, password=password)
            except User.DoesNotExist:
                pass
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        attrs['user'] = user
        return attrs


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------
class CampaignSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.company_name', read_only=True)
    brand_logo = serializers.SerializerMethodField()

    class Meta:
        model = Campaign
        fields = [
            'id', 'brand', 'brand_name', 'brand_logo', 'title', 'description', 'campaign_type',
            'status', 'products', 'shipping_info', 'deliverables_requested',
            'brief_text', 'brief_files', 'target_networks', 'content_format', 'content_formats',
            'price_per_influencer', 'deadline', 'target_filters',
            'is_casting', 'casting_criteria', 'max_influencers', 'image_rights', 'contract_template',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['brand', 'created_at', 'updated_at']

    def get_brand_logo(self, obj):
        request = self.context.get('request')
        return _abs_media_url(request, getattr(obj.brand, 'logo', None))


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
        url = obj.source_file.url
        return request.build_absolute_uri(url) if request else url


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
        return obj.submissions.order_by('-created_at').first()

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


# ---------------------------------------------------------------------------
# Message / Review / Notification
# ---------------------------------------------------------------------------
class MessageSerializer(serializers.ModelSerializer):
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
        return _abs_media_url(request, obj.image)


class SupportTicketSerializer(serializers.ModelSerializer):
    """Serializer for users — admin_note (internal) is NOT exposed."""
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    images = SupportTicketImageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'requester', 'requester_email',
            'subject', 'message', 'status', 'priority',
            'admin_reply',
            'images',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'requester', 'requester_email', 'status', 'admin_reply',
            'images', 'created_at', 'updated_at',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        target_lang = self.context.get('translate_to', '')
        if target_lang:
            data['subject'] = _translate(data['subject'], target_lang)
            data['message'] = _translate(data['message'], target_lang)
            if data.get('admin_reply'):
                data['admin_reply'] = _translate(data['admin_reply'], target_lang)
        return data


class SupportTicketAdminUpdateSerializer(serializers.ModelSerializer):
    """Serializer for admins — exposes both admin_reply (public) and admin_note (internal)."""
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    images = SupportTicketImageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'requester', 'requester_email',
            'subject', 'message', 'status', 'priority',
            'admin_reply', 'admin_note',
            'images',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['requester', 'requester_email', 'subject', 'message', 'images', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        target_lang = self.context.get('translate_to', '')
        if target_lang:
            data['subject'] = _translate(data['subject'], target_lang)
            data['message'] = _translate(data['message'], target_lang)
            if data.get('admin_reply'):
                data['admin_reply'] = _translate(data['admin_reply'], target_lang)
        return data


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
        read_only_fields = ['created_at']


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
        fields = ['commission_rate', 'validation_deadline_days', 'dispute_resolution_hours']


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
        read_only_fields = ['brand', 'user', 'status', 'invited_at', 'joined_at']

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
