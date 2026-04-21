from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import serializers
from cryptography.fernet import Fernet, InvalidToken
import base64
import hashlib

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile,
    Campaign, CampaignProposal, ContentSubmission,
    Message, Review, Notification, PlatformSettings,
    ContractTemplate, CastingApplication, AmbassadorProgram, AuditLog,
    MediaKitImage,
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


# ---------------------------------------------------------------------------
# Influencer
# ---------------------------------------------------------------------------
class SocialNetworkSerializer(serializers.ModelSerializer):
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

    class Meta:
        model = InfluencerProfile
        fields = [
            'id', 'bio', 'display_name', 'languages', 'content_themes',
            'content_types_offered', 'pricing', 'payment_method',
            'is_verified', 'average_rating', 'social_networks',
            'onboarding_completed', 'profile_completion_percent',
            'media_kit_pdf', 'media_kit_generated_at', 'media_kit_images',
            'stripe_account_id',
        ]
        read_only_fields = [
            'is_verified', 'average_rating',
            'profile_completion_percent', 'media_kit_pdf', 'media_kit_generated_at',
            'stripe_account_id',
        ]

    def get_media_kit_images(self, obj):
        request = self.context.get('request')
        result = []
        for img in obj.media_kit_images.all():
            url = img.image.url if img.image else None
            if request and url:
                url = request.build_absolute_uri(url)
            result.append({"id": img.id, "image": url, "caption": img.caption, "order": img.order})
        return result


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
    class Meta:
        model = BrandProfile
        fields = [
            'id', 'company_name', 'siret', 'logo', 'sector', 'description',
            'website', 'billing_address',
            'subscription_plan', 'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
        ]
        read_only_fields = [
            'subscription_active', 'subscription_expires_at',
            'validation_status', 'validation_notes', 'validated_at',
            'average_rating',
        ]


class BrandAdminSerializer(serializers.ModelSerializer):
    """Full brand view for admins (with Stripe ids and validator info)."""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    validated_by_username = serializers.CharField(source='validated_by.username', read_only=True)

    class Meta:
        model = BrandProfile
        fields = [
            'id', 'user_id', 'user_email', 'company_name', 'siret', 'sector',
            'website', 'billing_address',
            'subscription_plan', 'subscription_active', 'subscription_expires_at',
            'stripe_customer_id', 'stripe_subscription_id',
            'validation_status', 'validation_notes', 'validated_at',
            'validated_by_username',
        ]


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    influencer_profile = InfluencerProfileSerializer(read_only=True)
    brand_profile = BrandProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'language_preference', 'avatar', 'phone', 'location',
            'totp_enabled',
            'created_at', 'updated_at', 'influencer_profile', 'brand_profile',
        ]
        read_only_fields = ['user_type', 'created_at', 'updated_at', 'totp_enabled']


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
    # Influencer-specific
    display_name = serializers.CharField(max_length=100, required=False, default='')

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already registered.')
        return value

    def validate(self, attrs):
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

    class Meta:
        model = Campaign
        fields = [
            'id', 'brand', 'brand_name', 'title', 'description', 'campaign_type',
            'status', 'products', 'shipping_info', 'deliverables_requested',
            'brief_text', 'brief_files', 'target_networks', 'content_format', 'content_formats',
            'price_per_influencer', 'deadline', 'target_filters',
            'is_casting', 'casting_criteria', 'max_influencers', 'image_rights', 'contract_template',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['brand', 'created_at', 'updated_at']


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
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)
    brand_company_name = serializers.CharField(source='campaign.brand.company_name', read_only=True)
    brand_id = serializers.IntegerField(source='campaign.brand.id', read_only=True)

    class Meta:
        model = CampaignProposal
        fields = [
            'id', 'campaign', 'campaign_title', 'influencer', 'influencer_display_name',
            'brand_company_name', 'brand_id', 'status', 'proposed_price', 'counter_price',
            'counter_message', 'decline_reason',
            'contract_pdf', 'contract_version',
            'contract_signed_brand', 'contract_signed_influencer', 'contract_signed_at',
            'brand_signed_at', 'influencer_signed_at',
            'escrow_amount', 'escrow_funded', 'escrow_released',
            'escrow_funded_at', 'escrow_released_at',
            'submission_deadline', 'validation_deadline',
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

    class Meta:
        model = Message
        fields = ['id', 'proposal', 'sender', 'sender_username', 'content',
                  'attachments', 'read', 'created_at']
        read_only_fields = ['sender', 'read', 'created_at']


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


# ---------------------------------------------------------------------------
# Casting / Ambassador / AuditLog / Settings
# ---------------------------------------------------------------------------
class CastingApplicationSerializer(serializers.ModelSerializer):
    influencer_display_name = serializers.CharField(source='influencer.display_name', read_only=True)
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)

    class Meta:
        model = CastingApplication
        fields = [
            'id', 'campaign', 'campaign_title', 'influencer', 'influencer_display_name',
            'motivation', 'examples', 'status', 'created_at', 'decided_at',
        ]
        read_only_fields = ['status', 'created_at', 'decided_at']


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
