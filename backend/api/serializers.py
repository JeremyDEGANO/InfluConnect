from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from cryptography.fernet import Fernet, InvalidToken
import base64
import hashlib

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile,
    Campaign, CampaignProposal, ContentSubmission,
    Message, Review, Notification, PlatformSettings,
)


def get_fernet():
    key = settings.FERNET_KEY
    if not key:
        raw = b'influconnect-default-encryption-key-32b!'
        key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    elif isinstance(key, str):
        key = key.encode()
    return Fernet(key)


def encrypt_value(value: str) -> str:
    if not value:
        return value
    f = get_fernet()
    return f.encrypt(value.encode()).decode()


def decrypt_value(value: str) -> str:
    if not value:
        return value
    try:
        f = get_fernet()
        return f.decrypt(value.encode()).decode()
    except (InvalidToken, Exception):
        return value


class SocialNetworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialNetwork
        fields = ['id', 'platform', 'profile_url', 'followers_count', 'avg_views', 'engagement_rate']


class InfluencerProfileSerializer(serializers.ModelSerializer):
    social_networks = SocialNetworkSerializer(many=True, read_only=True)

    class Meta:
        model = InfluencerProfile
        fields = [
            'id', 'bio', 'display_name', 'content_themes', 'content_types_offered',
            'pricing', 'payment_method', 'is_verified', 'average_rating', 'social_networks',
        ]
        read_only_fields = ['is_verified', 'average_rating']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Never expose raw payment_details in list
        return data


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


class BrandProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandProfile
        fields = [
            'id', 'company_name', 'logo', 'sector', 'description', 'website',
            'billing_address', 'subscription_plan', 'subscription_active',
            'subscription_expires_at', 'average_rating',
        ]
        read_only_fields = ['subscription_active', 'subscription_expires_at', 'average_rating']


class UserSerializer(serializers.ModelSerializer):
    influencer_profile = InfluencerProfileSerializer(read_only=True)
    brand_profile = BrandProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'language_preference', 'avatar', 'phone', 'location',
            'created_at', 'updated_at', 'influencer_profile', 'brand_profile',
        ]
        read_only_fields = ['user_type', 'created_at', 'updated_at']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    user_type = serializers.ChoiceField(choices=['influencer', 'brand'])
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')
    # Brand-specific
    company_name = serializers.CharField(max_length=200, required=False, default='')
    # Influencer-specific
    display_name = serializers.CharField(max_length=100, required=False, default='')

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Username already taken.')
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already registered.')
        return value

    def validate(self, attrs):
        if attrs['user_type'] == 'brand' and not attrs.get('company_name'):
            raise serializers.ValidationError({'company_name': 'Required for brand registration.'})
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
            BrandProfile.objects.create(
                user=user,
                company_name=validated_data['company_name'],
            )
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs['username'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError('Invalid credentials.')
        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')
        attrs['user'] = user
        return attrs


class CampaignSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.company_name', read_only=True)

    class Meta:
        model = Campaign
        fields = [
            'id', 'brand', 'brand_name', 'title', 'description', 'campaign_type',
            'status', 'products', 'shipping_info', 'deliverables_requested',
            'brief_text', 'brief_files', 'target_networks', 'content_format',
            'price_per_influencer', 'deadline', 'target_filters',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['brand', 'created_at', 'updated_at']


class CampaignProposalSerializer(serializers.ModelSerializer):
    campaign_title = serializers.CharField(source='campaign.title', read_only=True)
    influencer_display_name = serializers.CharField(
        source='influencer.display_name', read_only=True
    )
    brand_company_name = serializers.CharField(
        source='campaign.brand.company_name', read_only=True
    )

    class Meta:
        model = CampaignProposal
        fields = [
            'id', 'campaign', 'campaign_title', 'influencer', 'influencer_display_name',
            'brand_company_name', 'status', 'proposed_price', 'counter_price',
            'counter_message', 'decline_reason', 'contract_pdf',
            'contract_signed_brand', 'contract_signed_influencer', 'contract_signed_at',
            'escrow_amount', 'escrow_funded', 'escrow_released',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'status', 'contract_signed_brand', 'contract_signed_influencer',
            'contract_signed_at', 'escrow_funded', 'escrow_released',
            'created_at', 'updated_at',
        ]


class ContentSubmissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentSubmission
        fields = [
            'id', 'proposal', 'submission_type', 'publication_url', 'uploaded_file',
            'screenshot', 'publication_date', 'initial_stats', 'final_stats',
            'brand_validated', 'brand_validation_date', 'rejection_reason',
            'rejection_comment', 'admin_validated', 'admin_notes', 'created_at',
        ]
        read_only_fields = [
            'brand_validated', 'brand_validation_date', 'rejection_reason',
            'rejection_comment', 'admin_validated', 'admin_notes', 'created_at',
        ]


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'proposal', 'sender', 'sender_username', 'content', 'attachments', 'read', 'created_at']
        read_only_fields = ['sender', 'read', 'created_at']


class ReviewSerializer(serializers.ModelSerializer):
    reviewer_username = serializers.CharField(source='reviewer.username', read_only=True)
    reviewee_username = serializers.CharField(source='reviewee.username', read_only=True)

    class Meta:
        model = Review
        fields = [
            'id', 'proposal', 'reviewer', 'reviewer_username',
            'reviewee', 'reviewee_username', 'rating', 'comment', 'created_at',
        ]
        read_only_fields = ['reviewer', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'notification_type', 'title', 'message',
            'related_proposal', 'read', 'email_sent', 'created_at',
        ]
        read_only_fields = ['notification_type', 'title', 'message', 'related_proposal', 'email_sent', 'created_at']


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = ['commission_rate', 'validation_deadline_days', 'dispute_resolution_hours']
