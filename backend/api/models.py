from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator


class User(AbstractUser):
    USER_TYPE_CHOICES = [
        ('influencer', 'Influencer'),
        ('brand', 'Brand'),
        ('admin', 'Admin'),
    ]
    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('fr', 'French'),
    ]

    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    language_preference = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.username} ({self.user_type})'


class InfluencerProfile(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('iban', 'IBAN'),
        ('paypal', 'PayPal'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='influencer_profile')
    bio = models.TextField(blank=True)
    display_name = models.CharField(max_length=100, blank=True)
    content_themes = models.JSONField(default=list)
    content_types_offered = models.JSONField(default=list)
    pricing = models.JSONField(default=dict)
    payment_method = models.CharField(max_length=20, blank=True, choices=PAYMENT_METHOD_CHOICES)
    payment_details = models.TextField(blank=True)
    is_verified = models.BooleanField(default=False)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    def __str__(self):
        return f'InfluencerProfile: {self.user.username}'


class SocialNetwork(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('tiktok', 'TikTok'),
        ('youtube', 'YouTube'),
        ('twitter', 'Twitter'),
        ('pinterest', 'Pinterest'),
    ]

    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='social_networks')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    profile_url = models.URLField()
    followers_count = models.IntegerField(default=0)
    avg_views = models.IntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    def __str__(self):
        return f'{self.influencer.user.username} - {self.platform}'


class BrandProfile(models.Model):
    SUBSCRIPTION_PLAN_CHOICES = [
        ('starter', 'Starter'),
        ('growth', 'Growth'),
        ('pro', 'Pro'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='brand_profile')
    company_name = models.CharField(max_length=200)
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    sector = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    billing_address = models.TextField(blank=True)
    subscription_plan = models.CharField(max_length=20, null=True, blank=True, choices=SUBSCRIPTION_PLAN_CHOICES)
    subscription_active = models.BooleanField(default=False)
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    def __str__(self):
        return f'BrandProfile: {self.company_name}'


class Campaign(models.Model):
    CAMPAIGN_TYPE_CHOICES = [
        ('gifting', 'Gifting'),
        ('paid', 'Paid'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='campaigns')
    title = models.CharField(max_length=200)
    description = models.TextField()
    campaign_type = models.CharField(max_length=20, choices=CAMPAIGN_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    products = models.JSONField(default=list, blank=True)
    shipping_info = models.TextField(blank=True)
    deliverables_requested = models.JSONField(default=list, blank=True)
    brief_text = models.TextField(blank=True)
    brief_files = models.FileField(upload_to='briefs/', null=True, blank=True)
    target_networks = models.JSONField(default=list, blank=True)
    content_format = models.CharField(max_length=100, blank=True)
    price_per_influencer = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    target_filters = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} ({self.brand.company_name})'


class CampaignProposal(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('counter_offer', 'Counter Offer'),
        ('contract_signed', 'Contract Signed'),
        ('in_progress', 'In Progress'),
        ('content_submitted', 'Content Submitted'),
        ('validated', 'Validated'),
        ('paid', 'Paid'),
        ('disputed', 'Disputed'),
    ]

    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='proposals')
    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='proposals')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    proposed_price = models.DecimalField(max_digits=10, decimal_places=2)
    counter_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    counter_message = models.TextField(blank=True)
    decline_reason = models.TextField(blank=True)
    contract_pdf = models.FileField(upload_to='contracts/', null=True, blank=True)
    contract_signed_brand = models.BooleanField(default=False)
    contract_signed_influencer = models.BooleanField(default=False)
    contract_signed_at = models.DateTimeField(null=True, blank=True)
    escrow_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    escrow_funded = models.BooleanField(default=False)
    escrow_released = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Proposal: {self.campaign.title} → {self.influencer.user.username}'


class ContentSubmission(models.Model):
    SUBMISSION_TYPE_CHOICES = [
        ('link', 'Link'),
        ('upload', 'Upload'),
    ]
    REJECTION_REASON_CHOICES = [
        ('brief_not_followed', 'Brief Not Followed'),
        ('wrong_platform', 'Wrong Platform'),
        ('missing_mention', 'Missing Mention'),
        ('insufficient_quality', 'Insufficient Quality'),
        ('late_delivery', 'Late Delivery'),
        ('other', 'Other'),
    ]

    proposal = models.ForeignKey(CampaignProposal, on_delete=models.CASCADE, related_name='submissions')
    submission_type = models.CharField(max_length=10, choices=SUBMISSION_TYPE_CHOICES)
    publication_url = models.URLField(blank=True)
    uploaded_file = models.FileField(upload_to='submissions/', null=True, blank=True)
    screenshot = models.ImageField(upload_to='screenshots/', null=True, blank=True)
    publication_date = models.DateTimeField()
    initial_stats = models.JSONField(default=dict)
    final_stats = models.JSONField(null=True, blank=True)
    brand_validated = models.BooleanField(null=True, blank=True)
    brand_validation_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=30, null=True, blank=True, choices=REJECTION_REASON_CHOICES)
    rejection_comment = models.TextField(blank=True)
    admin_validated = models.BooleanField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Submission for {self.proposal}'


class Message(models.Model):
    proposal = models.ForeignKey(CampaignProposal, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    attachments = models.FileField(upload_to='attachments/', null=True, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Message from {self.sender.username} on {self.proposal}'


class Review(models.Model):
    proposal = models.ForeignKey(CampaignProposal, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Review by {self.reviewer.username} → {self.reviewee.username} ({self.rating}/5)'


class Notification(models.Model):
    NOTIFICATION_TYPE_CHOICES = [
        ('new_proposal', 'New Proposal'),
        ('proposal_accepted', 'Proposal Accepted'),
        ('proposal_declined', 'Proposal Declined'),
        ('counter_offer', 'Counter Offer'),
        ('contract_ready', 'Contract Ready'),
        ('escrow_funded', 'Escrow Funded'),
        ('content_submitted', 'Content Submitted'),
        ('content_validated', 'Content Validated'),
        ('content_rejected', 'Content Rejected'),
        ('payment_released', 'Payment Released'),
        ('new_message', 'New Message'),
        ('new_review', 'New Review'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    related_proposal = models.ForeignKey(
        CampaignProposal, null=True, blank=True, on_delete=models.SET_NULL
    )
    read = models.BooleanField(default=False)
    email_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Notification for {self.user.username}: {self.title}'


class PlatformSettings(models.Model):
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15)
    validation_deadline_days = models.IntegerField(default=5)
    dispute_resolution_hours = models.IntegerField(default=48)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Platform Settings'
