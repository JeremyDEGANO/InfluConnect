from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
import secrets
import uuid


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


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
    AUTH_PROVIDER_CHOICES = [
        ('local', 'Local credentials'),
        ('google', 'Google SSO'),
        ('office365', 'Office 365 SSO'),
        ('saml', 'SAML SSO'),
        ('other_sso', 'Other SSO'),
    ]

    user_type = models.CharField(max_length=20, choices=USER_TYPE_CHOICES)
    auth_provider = models.CharField(max_length=20, choices=AUTH_PROVIDER_CHOICES, default='local')
    language_preference = models.CharField(max_length=5, choices=LANGUAGE_CHOICES, default='en')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=200, blank=True)
    totp_secret = models.CharField(max_length=64, blank=True)
    totp_enabled = models.BooleanField(default=False)
    email_2fa_enabled = models.BooleanField(default=False)
    active_brand_workspace = models.ForeignKey(
        'BrandProfile', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='active_users',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.username} ({self.user_type})'

    @property
    def is_sso_account(self) -> bool:
        return (self.auth_provider or 'local') != 'local'


class InfluencerProfile(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('iban', 'IBAN'),
        ('paypal', 'PayPal'),
    ]
    GENDER_CHOICES = [
        ('she', 'Elle'),
        ('he', 'Il'),
        ('they', 'Iel'),
        ('other', 'Autre'),
        ('prefer_not', 'Préfère ne pas dire'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='influencer_profile')
    bio = models.TextField(blank=True)
    display_name = models.CharField(max_length=100, blank=True)
    gender = models.CharField(max_length=20, blank=True, choices=GENDER_CHOICES)
    collaboration_pitch = models.TextField(blank=True)
    languages = models.JSONField(default=list, blank=True)  # CDC §4.1
    content_themes = models.JSONField(default=list)
    content_types_offered = models.JSONField(default=list)
    pricing = models.JSONField(default=dict)
    payment_method = models.CharField(max_length=20, blank=True, choices=PAYMENT_METHOD_CHOICES)
    payment_details = models.TextField(blank=True)  # encrypted via Fernet
    is_verified = models.BooleanField(default=False)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    # Onboarding & Media Kit (CDC §4.2)
    onboarding_completed = models.BooleanField(default=False)
    profile_completion_percent = models.IntegerField(default=0)
    media_kit_pdf = models.FileField(upload_to='media_kits/', null=True, blank=True)
    media_kit_generated_at = models.DateTimeField(null=True, blank=True)
    media_kit_is_custom = models.BooleanField(default=False)
    # List of {"label": str, "url": str} entries — portfolio / sample content links
    content_links = models.JSONField(default=list, blank=True)

    # Stripe Connect (for payouts)
    stripe_account_id = models.CharField(max_length=100, blank=True)
    stripe_onboarding_url = models.URLField(blank=True)
    referral_code = models.CharField(max_length=20, unique=True, blank=True, null=True)
    referred_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        related_name='referrals_made',
    )
    referral_code_used_at = models.DateTimeField(null=True, blank=True)
    referral_commission_discount_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text='Discount points applied to the platform commission for this influencer.',
    )

    def __str__(self):
        return f'InfluencerProfile: {self.user.username}'


class SocialNetwork(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('tiktok', 'TikTok'),
        ('youtube', 'YouTube'),
        ('twitter', 'Twitter/X'),
        ('pinterest', 'Pinterest'),
        ('twitch', 'Twitch'),
        ('linkedin', 'LinkedIn'),
        ('snapchat', 'Snapchat'),
    ]
    TOKEN_STATUS_CHOICES = [
        ('none', 'None'),
        ('active', 'Active'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
        ('error', 'Error'),
    ]

    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='social_networks')
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    profile_url = models.URLField()
    followers_count = models.IntegerField(default=0)
    avg_views = models.IntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    # External account metadata (populated when OAuth is connected).
    external_user_id = models.CharField(max_length=128, blank=True)
    external_username = models.CharField(max_length=128, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    avatar_url = models.URLField(blank=True, max_length=600)
    bio = models.TextField(blank=True)
    is_verified_external = models.BooleanField(default=False)
    video_count = models.IntegerField(default=0)
    total_likes = models.BigIntegerField(default=0)

    # OAuth (CDC §8 — stats import). Tokens stored encrypted via Fernet.
    oauth_access_token = models.TextField(blank=True)
    oauth_refresh_token = models.TextField(blank=True)
    oauth_expires_at = models.DateTimeField(null=True, blank=True)
    token_status = models.CharField(max_length=12, choices=TOKEN_STATUS_CHOICES, default='none')
    last_synced_at = models.DateTimeField(null=True, blank=True)
    verified_via_api = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.influencer.user.username} - {self.platform}'

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['influencer', 'platform'], name='uniq_social_network_per_platform'),
        ]


class SocialVideo(models.Model):
    """Recent video imported from the connected social account (max ~20 per network)."""
    social_network = models.ForeignKey(
        SocialNetwork, on_delete=models.CASCADE, related_name='videos',
    )
    external_video_id = models.CharField(max_length=128)
    caption = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True, max_length=600)
    video_url = models.URLField(blank=True, max_length=600)
    view_count = models.BigIntegerField(default=0)
    like_count = models.BigIntegerField(default=0)
    comment_count = models.BigIntegerField(default=0)
    share_count = models.BigIntegerField(default=0)
    duration_sec = models.IntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['social_network', 'external_video_id'],
                name='uniq_social_video_per_account',
            ),
        ]
        ordering = ['-published_at', '-id']

    def __str__(self):
        return f'SocialVideo[{self.external_video_id}] {self.social_network.platform}'


class SocialStatsSnapshot(models.Model):
    """Daily snapshot of social network stats for trend analysis."""
    social_network = models.ForeignKey(
        SocialNetwork, on_delete=models.CASCADE, related_name='stats_snapshots',
    )
    snapshot_date = models.DateField()
    followers_count = models.IntegerField(default=0)
    avg_views = models.IntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    raw_response = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['social_network', 'snapshot_date'],
                name='uniq_social_snapshot_per_day',
            ),
        ]
        ordering = ['-snapshot_date']


class MediaKitImage(models.Model):
    """Up to 3 portfolio images included in the influencer media kit."""
    influencer = models.ForeignKey(
        InfluencerProfile, on_delete=models.CASCADE, related_name='media_kit_images',
    )
    image = models.ImageField(upload_to='media_kit_gallery/')
    caption = models.CharField(max_length=120, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f'MediaKitImage[{self.id}] {self.influencer.user.username}'


class BrandOrganization(models.Model):
    """The client company. Groups every environment (BrandProfile) of the same
    customer so a single subscription/team can span multiple legal entities."""
    name = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'BrandOrganization: {self.name}'


class BrandProfile(models.Model):
    SUBSCRIPTION_PLAN_CHOICES = [
        ('starter', 'Starter'),
        ('growth', 'Growth'),
        ('pro', 'Pro'),
    ]
    VALIDATION_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='brand_profile')
    organization = models.ForeignKey(
        BrandOrganization, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='environments',
    )
    company_name = models.CharField(max_length=200)
    siret = models.CharField(max_length=20, blank=True)  # CDC §5.1
    logo = models.ImageField(upload_to='logos/', null=True, blank=True)
    sector = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    billing_address = models.TextField(blank=True)

    # Subscription
    subscription_plan = models.CharField(max_length=20, null=True, blank=True, choices=SUBSCRIPTION_PLAN_CHOICES)
    subscription_active = models.BooleanField(default=False)
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    stripe_customer_id = models.CharField(max_length=100, blank=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True)

    # Admin validation workflow (CDC §5.1)
    validation_status = models.CharField(
        max_length=20, choices=VALIDATION_STATUS_CHOICES, default='pending',
    )
    validation_notes = models.TextField(blank=True)
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='brands_validated'
    )

    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)

    # Agency mode (CDC §11 — agency representing influencers)
    is_agency = models.BooleanField(default=False)
    agency_default_commission_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=20,
        help_text="Default commission percent applied on managed influencers' earnings.",
    )

    def __str__(self):
        return f'BrandProfile: {self.company_name}'


class BrandMembership(models.Model):
    """Multi-user enterprise: extra users attached to a brand workspace."""
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]
    STATUS_CHOICES = [
        ('invited', 'Invited'),
        ('active', 'Active'),
        ('revoked', 'Revoked'),
    ]
    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='brand_memberships')
    invited_email = models.EmailField(blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='invited')
    invited_at = models.DateTimeField(auto_now_add=True)
    joined_at = models.DateTimeField(null=True, blank=True)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='brand_invitations_sent')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['brand', 'user'], condition=models.Q(user__isnull=False), name='uniq_brand_user_membership'),
            models.UniqueConstraint(fields=['brand', 'invited_email'], condition=~models.Q(invited_email=''), name='uniq_brand_email_membership'),
        ]

    def __str__(self):
        return f'{self.brand.company_name} — {self.user_id or self.invited_email} ({self.role})'


class OrganizationMembership(models.Model):
    """Global access to ALL environments of an organization.

    role 'admin'  → global administrator of the client (manages every
                    environment, members and invitations).
    role 'member' → operational access to every environment, no member management.
    """
    ROLE_CHOICES = [
        ('admin', 'Global admin'),
        ('member', 'Global member'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('revoked', 'Revoked'),
    ]
    organization = models.ForeignKey(BrandOrganization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organization_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organization', 'user'], name='uniq_org_user_membership'),
        ]

    def __str__(self):
        return f'{self.organization.name} — {self.user.email} (global {self.role})'


class TeamInvitation(models.Model):
    """Secure email invitation to join one, several or all environments of an
    organization. The invitee must follow the emailed token link and either log
    in with the invited email or create an account before access is granted."""
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]
    SCOPE_CHOICES = [
        ('global', 'All environments (global)'),
        ('environments', 'Selected environments'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('cancelled', 'Cancelled'),
        ('expired', 'Expired'),
    ]
    EXPIRY_DAYS = 7

    organization = models.ForeignKey(BrandOrganization, on_delete=models.CASCADE, related_name='team_invitations')
    invited_email = models.EmailField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='environments')
    environments = models.ManyToManyField(BrandProfile, blank=True, related_name='team_invitations')
    token = models.CharField(max_length=64, unique=True, editable=False, default=generate_invitation_token)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    message = models.TextField(blank=True)
    invited_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='team_invitations_sent')
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='team_invitations_accepted')

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['organization', 'invited_email'],
                condition=models.Q(status='pending'),
                name='uniq_pending_team_invitation_per_email',
            ),
        ]

    def __str__(self):
        return f'TeamInvitation: {self.invited_email} → {self.organization.name} ({self.status})'

    @property
    def is_expired(self) -> bool:
        from django.utils import timezone
        return self.status == 'pending' and self.expires_at and self.expires_at < timezone.now()


class AgencyDelegation(models.Model):
    """Delegation contract between an agency (BrandProfile.is_agency=True) and an influencer."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('revoked', 'Revoked'),
    ]
    agency = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='delegations_as_agency')
    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='agency_delegations')
    commission_percent = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    invitation_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('agency', 'influencer')]

    def __str__(self):
        return f'{self.agency.company_name} ⇄ {self.influencer.user.username} ({self.status})'


class ContractTemplate(models.Model):
    """Reusable contract template (Growth/Pro plan only — CDC §6.3)."""
    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='contract_templates')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    body_html = models.TextField()
    source_file = models.FileField(upload_to='contract_templates/', null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.brand.company_name} - {self.name}'


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
    description = models.TextField(blank=True)
    campaign_type = models.CharField(max_length=20, choices=CAMPAIGN_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    products = models.JSONField(default=list, blank=True)
    shipping_info = models.TextField(blank=True)
    deliverables_requested = models.JSONField(default=list, blank=True)
    brief_text = models.TextField(blank=True)
    brief_files = models.FileField(upload_to='briefs/', null=True, blank=True)
    target_networks = models.JSONField(default=list, blank=True)
    content_format = models.CharField(max_length=100, blank=True)
    # List of {"code": str, "quantity": int} — e.g. [{"code": "story", "quantity": 3}, {"code": "reel_short", "quantity": 1}]
    content_formats = models.JSONField(default=list, blank=True)
    price_per_influencer = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    target_filters = models.JSONField(default=dict, blank=True)

    # Casting / open application mode (CDC §10.5)
    is_casting = models.BooleanField(default=False)
    casting_criteria = models.JSONField(default=dict, blank=True)

    # Number of influencers the campaign is looking for (1 = single, N = multi-slot)
    max_influencers = models.PositiveIntegerField(default=1)

    # Image rights (CDC §10.4)
    image_rights = models.JSONField(default=dict, blank=True)

    # Optional contract template
    contract_template = models.ForeignKey(
        ContractTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name='campaigns'
    )

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

    # Contract & Signature (CDC §6 — eIDAS-grade audit trail)
    contract_template = models.ForeignKey(ContractTemplate, null=True, blank=True, on_delete=models.SET_NULL, related_name='proposals')
    contract_pdf = models.FileField(upload_to='contracts/', null=True, blank=True)
    contract_version = models.IntegerField(default=1)
    contract_signed_brand = models.BooleanField(default=False)
    contract_signed_influencer = models.BooleanField(default=False)
    contract_signed_at = models.DateTimeField(null=True, blank=True)
    brand_signed_at = models.DateTimeField(null=True, blank=True)
    influencer_signed_at = models.DateTimeField(null=True, blank=True)
    brand_signature_mode = models.CharField(max_length=32, blank=True)
    brand_signature_value = models.TextField(blank=True)
    brand_signature_data = models.TextField(blank=True)
    influencer_signature_mode = models.CharField(max_length=32, blank=True)
    influencer_signature_value = models.TextField(blank=True)
    influencer_signature_data = models.TextField(blank=True)
    brand_signature_ip = models.GenericIPAddressField(null=True, blank=True)
    influencer_signature_ip = models.GenericIPAddressField(null=True, blank=True)

    # Escrow
    escrow_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    escrow_funded = models.BooleanField(default=False)
    escrow_released = models.BooleanField(default=False)
    escrow_funded_at = models.DateTimeField(null=True, blank=True)
    escrow_released_at = models.DateTimeField(null=True, blank=True)
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True)
    stripe_transfer_id = models.CharField(max_length=100, blank=True)

    # Validation deadlines
    submission_deadline = models.DateTimeField(null=True, blank=True)
    validation_deadline = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Proposal: {self.campaign.title} → {self.influencer.user.username}'


class Event(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    ]

    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='events')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255)
    city = models.CharField(max_length=120, blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    max_invitees = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-starts_at', '-id']

    def __str__(self):
        return f'Event: {self.title} ({self.brand.company_name})'


class EventInvitation(models.Model):
    RSVP_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='invitations')
    influencer = models.ForeignKey(InfluencerProfile, null=True, blank=True, on_delete=models.CASCADE, related_name='event_invitations')
    invited_email = models.EmailField(blank=True)
    invite_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=RSVP_STATUS_CHOICES, default='pending')
    max_plus_ones = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(2)])
    plus_ones_confirmed = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(2)])
    response_message = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='event_checkins')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [
            models.UniqueConstraint(fields=['event', 'influencer'], name='uniq_event_invitation_per_influencer'),
            models.UniqueConstraint(fields=['event', 'invited_email'], condition=~models.Q(invited_email=''), name='uniq_event_invitation_per_email'),
        ]

    def __str__(self):
        target = self.invited_email or (self.influencer.user.username if self.influencer_id else 'external')
        return f'EventInvitation: {self.event.title} → {target} ({self.status})'


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
    correction_requested = models.BooleanField(default=False)
    correction_deadline = models.DateTimeField(null=True, blank=True)
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


class DirectMessage(models.Model):
    """Direct messages between users (not linked to a campaign)."""
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_direct_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_direct_messages')
    content = models.TextField()
    attachments = models.FileField(upload_to='attachments/', null=True, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'DM from {self.sender.username} to {self.recipient.username}'


class Review(models.Model):
    """Multi-criteria review (CDC §4.6 & §5.8)."""
    proposal = models.ForeignKey(CampaignProposal, on_delete=models.CASCADE, related_name='reviews')
    reviewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_given')
    reviewee = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews_received')
    rating = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    criteria_ratings = models.JSONField(default=dict, blank=True)
    comment = models.TextField()
    is_published = models.BooleanField(default=False)
    moderated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='reviews_moderated'
    )
    moderated_at = models.DateTimeField(null=True, blank=True)
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
        ('contract_signed', 'Contract Signed'),
        ('escrow_funded', 'Escrow Funded'),
        ('content_submitted', 'Content Submitted'),
        ('content_validated', 'Content Validated'),
        ('content_rejected', 'Content Rejected'),
        ('payment_released', 'Payment Released'),
        ('new_message', 'New Message'),
        ('new_review', 'New Review'),
        ('brand_validated', 'Brand Validated'),
        ('brand_rejected', 'Brand Rejected'),
        ('subscription_changed', 'Subscription Changed'),
        ('casting_application', 'Casting Application'),
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


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In progress'),
        ('closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    source_language = models.CharField(max_length=5, blank=True, default='')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='normal')
    admin_note = models.TextField(blank=True)   # note interne (non visible par l'utilisateur)
    admin_reply = models.TextField(blank=True)  # réponse publique visible par l'utilisateur
    rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    rated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'SupportTicket #{self.id} - {self.subject}'


class SupportTicketImage(models.Model):
    """Pièces jointes image (max 5) sur un ticket support."""
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='support/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Image #{self.id} for ticket #{self.ticket_id}'


class TranslationCache(models.Model):
    """Cache persistant des traductions DeepL (évite de retraduire le même texte)."""
    cache_key = models.CharField(max_length=64, unique=True, db_index=True)
    translated_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'translation_cache'


class CastingApplication(models.Model):
    """CDC §10.5 — when Campaign.is_casting=True, influencers apply."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('selected', 'Selected'),
        ('rejected', 'Rejected'),
    ]
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name='casting_applications')
    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='casting_applications')
    motivation = models.TextField()
    examples = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('campaign', 'influencer')]

    def __str__(self):
        return f'Casting application: {self.influencer.user.username} → {self.campaign.title}'


class AmbassadorProgram(models.Model):
    """CDC §10.1 — long-term brand × influencer relationship."""
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('ended', 'Ended'),
    ]
    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='ambassador_programs')
    influencer = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='ambassador_programs')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    monthly_budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    kpis = models.JSONField(default=dict, blank=True)
    bonus_rules = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    starts_at = models.DateField()
    ends_at = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.brand.company_name} × {self.influencer.user.username})'


class AuditLog(models.Model):
    """CDC §11.3 — sensitive action audit trail."""
    ACTION_CHOICES = [
        ('brand_validated', 'Brand Validated'),
        ('brand_rejected', 'Brand Rejected'),
        ('escrow_funded', 'Escrow Funded'),
        ('escrow_released', 'Escrow Released'),
        ('escrow_refunded', 'Escrow Refunded'),
        ('contract_signed', 'Contract Signed'),
        ('content_validated', 'Content Validated'),
        ('content_rejected', 'Content Rejected'),
        ('admin_arbitrated', 'Admin Arbitrated'),
        ('subscription_created', 'Subscription Created'),
        ('subscription_changed', 'Subscription Changed'),
        ('subscription_cancelled', 'Subscription Cancelled'),
        ('user_suspended', 'User Suspended'),
        ('review_moderated', 'Review Moderated'),
    ]
    actor = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_actions')
    action = models.CharField(max_length=40, choices=ACTION_CHOICES)
    target_type = models.CharField(max_length=50, blank=True)
    target_id = models.IntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} by {self.actor or "system"} at {self.created_at}'


class PlatformSettings(models.Model):
    commission_rate = models.DecimalField(max_digits=5, decimal_places=2, default=15)
    referral_commission_discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=3)
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


class InfluencerReferralInvite(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('accepted', 'Accepted'),
        ('cancelled', 'Cancelled'),
    ]

    inviter = models.ForeignKey(InfluencerProfile, on_delete=models.CASCADE, related_name='sent_referral_invites')
    invited_email = models.EmailField()
    invitation_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    referral_code_snapshot = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='sent')
    accepted_by = models.ForeignKey(
        InfluencerProfile, null=True, blank=True, on_delete=models.SET_NULL,
        related_name='accepted_referral_invites',
    )
    invitation_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['inviter', 'invited_email'],
                condition=models.Q(status='sent'),
                name='uniq_open_referral_invite_per_email',
            ),
        ]

    def __str__(self):
        return f'ReferralInvite: {self.inviter.user.username} -> {self.invited_email} ({self.status})'


# ---------------------------------------------------------------------------
# Campaign video tracking (CDC §6 — performance dashboard)
# ---------------------------------------------------------------------------
class CampaignVideoTracking(models.Model):
    """Track a single video posted by an influencer for a campaign.

    Stats are refreshed daily for `TRACKING_WINDOW_DAYS` days then frozen.
    """
    TRACKING_WINDOW_DAYS = 30

    proposal = models.ForeignKey(
        CampaignProposal, on_delete=models.CASCADE, related_name='tracked_videos',
    )
    social_network = models.ForeignKey(
        SocialNetwork, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='tracked_campaign_videos',
    )
    platform = models.CharField(max_length=20, choices=SocialNetwork.PLATFORM_CHOICES)
    external_video_id = models.CharField(max_length=128)
    video_url = models.URLField(max_length=600)
    caption = models.TextField(blank=True)
    thumbnail_url = models.URLField(blank=True, max_length=600)
    tracking_started_at = models.DateTimeField(auto_now_add=True)
    tracking_ends_at = models.DateTimeField(null=True, blank=True)
    is_frozen = models.BooleanField(default=False)
    last_fetched_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['proposal', 'platform', 'external_video_id'],
                name='uniq_tracked_video_per_proposal',
            ),
        ]
        ordering = ['-tracking_started_at']

    def __str__(self):
        return f'TrackedVideo[{self.platform}#{self.external_video_id}] proposal={self.proposal_id}'


class CampaignVideoDailyStats(models.Model):
    """Daily snapshot of a tracked campaign video's public counters."""
    tracking = models.ForeignKey(
        CampaignVideoTracking, on_delete=models.CASCADE, related_name='daily_stats',
    )
    snapshot_date = models.DateField()
    view_count = models.BigIntegerField(default=0)
    like_count = models.BigIntegerField(default=0)
    comment_count = models.BigIntegerField(default=0)
    share_count = models.BigIntegerField(default=0)
    engagement_rate = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['tracking', 'snapshot_date'],
                name='uniq_tracked_video_stats_per_day',
            ),
        ]
        ordering = ['-snapshot_date']


# ---------------------------------------------------------------------------
# Anti-fraud flags (CDC §10)
# ---------------------------------------------------------------------------
class SocialFraudFlag(models.Model):
    FLAG_TYPES = [
        ('follower_spike', 'Follower spike'),
        ('low_engagement', 'Low engagement'),
        ('zombie_account', 'Zombie account'),
    ]
    SEVERITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    social_network = models.ForeignKey(
        SocialNetwork, on_delete=models.CASCADE, related_name='fraud_flags',
    )
    flag_type = models.CharField(max_length=32, choices=FLAG_TYPES)
    severity = models.CharField(max_length=8, choices=SEVERITY_CHOICES, default='medium')
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['social_network', 'flag_type', 'resolved_at'])]

    def __str__(self):
        return f'FraudFlag[{self.flag_type}] sn={self.social_network_id}'


# ---------------------------------------------------------------------------
# Enterprise SSO + Domain verification (Office 365 / OIDC)
# ---------------------------------------------------------------------------
class BrandDomain(models.Model):
    """A DNS domain owned by a brand/agency, used to gate SSO sign-in."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('failed', 'Failed'),
        ('expired', 'Expired'),
    ]
    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='domains')
    domain = models.CharField(max_length=253, db_index=True)
    verification_token = models.CharField(max_length=64)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    verified_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['brand', 'domain'], name='uniq_brand_domain'),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.domain} ({self.status})'


class BrandSSOConfig(models.Model):
    """Per-brand SSO configuration (currently Office 365 / Entra ID)."""
    PROVIDER_CHOICES = [
        ('office365', 'Office 365 / Entra ID'),
    ]
    brand = models.OneToOneField(BrandProfile, on_delete=models.CASCADE, related_name='sso_config')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default='office365')
    enabled = models.BooleanField(default=False)
    tenant_id = models.CharField(max_length=64, blank=True)
    client_id = models.CharField(max_length=64, blank=True)
    client_secret_enc = models.TextField(blank=True)  # Fernet-encrypted
    enforce_sso = models.BooleanField(default=False)
    allow_local_fallback_for_owner = models.BooleanField(default=True)
    auto_provision_users = models.BooleanField(default=False)
    default_role = models.CharField(max_length=20, default='member')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'SSO[{self.provider}] brand={self.brand_id}'


# ---------------------------------------------------------------------------
# Public API keys + audit log
# ---------------------------------------------------------------------------
class ApiKey(models.Model):
    """Public API access key for a brand/agency. The secret is only shown once at creation."""
    SCOPE_CHOICES = [
        ('campaigns:read', 'Read campaigns'),
        ('campaigns:write', 'Write campaigns'),
        ('proposals:read', 'Read proposals'),
        ('proposals:write', 'Write proposals'),
        ('influencers:read', 'Read influencers'),
        ('influencers:verify', 'Trigger influencer verification'),
        ('reporting:read', 'Read reporting'),
        ('contracts:read', 'Read contracts'),
        ('webhooks:manage', 'Manage webhooks'),
    ]

    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='api_keys')
    name = models.CharField(max_length=120)
    prefix = models.CharField(max_length=24, unique=True, db_index=True)  # e.g. "ic_live_AbCd1234"
    hashed_secret = models.CharField(max_length=128)  # sha256 hex
    scopes = models.JSONField(default=list, blank=True)
    ip_allowlist = models.JSONField(default=list, blank=True)  # list of CIDRs / IPs
    last_used_at = models.DateTimeField(null=True, blank=True)
    last_used_ip = models.GenericIPAddressField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'ApiKey[{self.prefix}] brand={self.brand_id}'

    @property
    def is_active(self) -> bool:
        from django.utils import timezone
        if self.revoked_at:
            return False
        if self.expires_at and self.expires_at < timezone.now():
            return False
        return True


class ApiAuditLog(models.Model):
    """Audit trail for every public API call (success or error)."""
    api_key = models.ForeignKey(ApiKey, null=True, blank=True, on_delete=models.SET_NULL, related_name='audit_entries')
    brand = models.ForeignKey(BrandProfile, null=True, blank=True, on_delete=models.SET_NULL, related_name='api_audit_entries')
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=255)
    status_code = models.PositiveSmallIntegerField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    latency_ms = models.PositiveIntegerField(default=0)
    request_id = models.CharField(max_length=36, blank=True)
    error = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['brand', '-created_at']),
            models.Index(fields=['api_key', '-created_at']),
        ]


# ---------------------------------------------------------------------------
# Webhooks (outbound event delivery)
# ---------------------------------------------------------------------------
class WebhookEndpoint(models.Model):
    """Customer-managed HTTPS endpoint receiving signed event POSTs."""
    EVENT_CHOICES = [
        ('proposal.created', 'Proposal created'),
        ('proposal.accepted', 'Proposal accepted'),
        ('proposal.declined', 'Proposal declined'),
        ('proposal.counter_offered', 'Proposal counter-offered'),
        ('content.submitted', 'Content submitted'),
        ('content.validated', 'Content validated'),
        ('content.rejected', 'Content rejected'),
        ('contract.signed', 'Contract signed'),
        ('escrow.funded', 'Escrow funded'),
        ('payment.released', 'Payment released'),
        ('campaign.status_changed', 'Campaign status changed'),
        ('influencer.verified', 'Influencer verified'),
        ('agency.delegation.accepted', 'Agency delegation accepted'),
    ]

    brand = models.ForeignKey(BrandProfile, on_delete=models.CASCADE, related_name='webhook_endpoints')
    url = models.URLField(max_length=600)
    secret = models.CharField(max_length=64)  # used for HMAC-SHA256 signature
    events = models.JSONField(default=list, blank=True)  # subset of EVENT_CHOICES values; [] = all
    description = models.CharField(max_length=255, blank=True)
    enabled = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    last_delivery_at = models.DateTimeField(null=True, blank=True)
    last_status = models.CharField(max_length=16, blank=True)  # success / failed

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Webhook {self.url} brand={self.brand_id}'


class WebhookDelivery(models.Model):
    """Each attempt to deliver an event to a WebhookEndpoint."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('retry', 'Retry'),
    ]
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name='deliveries')
    event = models.CharField(max_length=64)
    payload = models.JSONField(default=dict)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending')
    attempts = models.PositiveSmallIntegerField(default=0)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True)
    error = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['endpoint', '-created_at'])]

    def __str__(self):
        return f'Delivery[{self.event}] -> ep={self.endpoint_id} ({self.status})'
