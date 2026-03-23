from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User, InfluencerProfile, SocialNetwork, BrandProfile,
    Campaign, CampaignProposal, ContentSubmission,
    Message, Review, Notification, PlatformSettings,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['username', 'email', 'user_type', 'is_active', 'created_at']
    list_filter = ['user_type', 'is_active', 'is_staff']
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile', {'fields': ('user_type', 'language_preference', 'avatar', 'phone', 'location')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Profile', {'fields': ('user_type', 'language_preference')}),
    )


@admin.register(InfluencerProfile)
class InfluencerProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'display_name', 'is_verified', 'average_rating']
    list_filter = ['is_verified', 'payment_method']
    search_fields = ['user__username', 'display_name']
    list_editable = ['is_verified']


@admin.register(SocialNetwork)
class SocialNetworkAdmin(admin.ModelAdmin):
    list_display = ['influencer', 'platform', 'followers_count', 'engagement_rate']
    list_filter = ['platform']
    search_fields = ['influencer__user__username']


@admin.register(BrandProfile)
class BrandProfileAdmin(admin.ModelAdmin):
    list_display = ['company_name', 'user', 'subscription_plan', 'subscription_active', 'average_rating']
    list_filter = ['subscription_plan', 'subscription_active']
    search_fields = ['company_name', 'user__username']


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ['title', 'brand', 'campaign_type', 'status', 'created_at']
    list_filter = ['campaign_type', 'status']
    search_fields = ['title', 'brand__company_name']
    date_hierarchy = 'created_at'


@admin.register(CampaignProposal)
class CampaignProposalAdmin(admin.ModelAdmin):
    list_display = ['campaign', 'influencer', 'status', 'proposed_price', 'escrow_funded', 'created_at']
    list_filter = ['status', 'escrow_funded', 'escrow_released']
    search_fields = ['campaign__title', 'influencer__user__username']
    date_hierarchy = 'created_at'


@admin.register(ContentSubmission)
class ContentSubmissionAdmin(admin.ModelAdmin):
    list_display = ['proposal', 'submission_type', 'brand_validated', 'admin_validated', 'created_at']
    list_filter = ['submission_type', 'brand_validated', 'admin_validated']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['proposal', 'sender', 'read', 'created_at']
    list_filter = ['read']
    search_fields = ['sender__username', 'content']


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['reviewer', 'reviewee', 'rating', 'created_at']
    list_filter = ['rating']
    search_fields = ['reviewer__username', 'reviewee__username']


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'read', 'created_at']
    list_filter = ['notification_type', 'read', 'email_sent']
    search_fields = ['user__username', 'title']


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ['commission_rate', 'validation_deadline_days', 'dispute_resolution_hours']

    def has_add_permission(self, request):
        return not PlatformSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
