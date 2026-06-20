from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views, views_extra
from . import views_auth
from . import views_plans
from . import views_sso
from . import views_api_mgmt
from . import views_api_v1
from . import views_team_invitations

router = DefaultRouter()
router.register(r"influencers/social-networks", views.SocialNetworkViewSet, basename="social-network")
router.register(r"campaigns", views.CampaignViewSet, basename="campaign")
router.register(r"events", views.EventViewSet, basename="event")
router.register(r"ambassador-programs", views_extra.AmbassadorProgramViewSet, basename="ambassador-program")
router.register(r"influencers/media-kit-images", views_extra.MediaKitImageViewSet, basename="media-kit-image")
router.register(r"contract-templates", views_extra.ContractTemplateViewSet, basename="contract-template")

urlpatterns = [
    path("health/", views_extra.HealthCheckView.as_view(), name="health"),
    path("health/ready/", views_extra.ReadinessCheckView.as_view(), name="health-ready"),
    # ---- Auth ----
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/2fa/setup/", views_auth.TOTPSetupView.as_view(), name="2fa-setup"),
    path("auth/2fa/confirm/", views_auth.TOTPConfirmView.as_view(), name="2fa-confirm"),
    path("auth/2fa/disable/", views_auth.TOTPDisableView.as_view(), name="2fa-disable"),
    path("auth/2fa/email/enable/", views_auth.Email2FAEnableView.as_view(), name="2fa-email-enable"),
    path("auth/2fa/email/disable/", views_auth.Email2FADisableView.as_view(), name="2fa-email-disable"),
    path("auth/2fa/reset/", views_auth.TOTPResetRequestView.as_view(), name="2fa-reset"),
    path("auth/2fa/reset-confirm/", views_auth.TOTPResetConfirmView.as_view(), name="2fa-reset-confirm"),
    path("auth/password-change/", views_auth.PasswordChangeView.as_view(), name="password-change"),
    path("auth/password-reset/", views_auth.PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset-confirm/", views_auth.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # ---- Reference data (public) ----
    path("reference/plans/", views_extra.SubscriptionPlansView.as_view(), name="plans"),
    path("reference/data/", views_extra.ReferenceDataView.as_view(), name="reference-data"),
    path("gifs/", views_extra.GifProxyView.as_view(), name="gif-proxy"),
    path("influencers/pseudo-availability/", views_extra.InfluencerPseudoAvailabilityView.as_view(), name="influencer-pseudo-availability"),
    path("stripe/config/", views_extra.StripeConfigView.as_view(), name="stripe-config"),
    path("public/marketplace/", views_extra.PublicMarketplaceView.as_view(), name="public-marketplace"),
    path("marketplace/contact/", views_extra.MarketplaceContactInfluencerView.as_view(), name="marketplace-contact-influencer"),

    # ---- Influencers ----
    path("influencers/", views.InfluencerListView.as_view(), name="influencer-list"),
    path("influencers/profile/", views.InfluencerProfileUpdateView.as_view(), name="influencer-profile-update"),
    path("influencers/dashboard/", views.InfluencerDashboardView.as_view(), name="influencer-dashboard"),
    path("influencers/onboarding/", views_extra.InfluencerOnboardingStatusView.as_view(), name="influencer-onboarding"),
    path("influencers/media-kit/generate/", views_extra.MediaKitGenerateView.as_view(), name="media-kit-generate"),
    path("influencers/media-kit/upload/", views_extra.MediaKitUploadView.as_view(), name="media-kit-upload"),
    path("influencers/stripe-onboard/", views_extra.InfluencerStripeOnboardView.as_view(), name="influencer-stripe-onboard"),
    path("influencers/referral/", views_extra.InfluencerReferralOverviewView.as_view(), name="influencer-referral-overview"),
    path("influencers/referral/invitations/", views_extra.InfluencerReferralInviteListCreateView.as_view(), name="influencer-referral-invitations"),
    path("influencers/p/<str:pseudo>/", views.InfluencerDetailByPseudoView.as_view(), name="influencer-detail-by-pseudo"),
    path("influencers/<int:pk>/", views.InfluencerDetailView.as_view(), name="influencer-detail"),

    # Social network OAuth (stub)
    path("social-networks/<int:pk>/oauth-start/", views_extra.SocialOAuthStartView.as_view(), name="social-oauth-start"),
    path("social-networks/<int:pk>/sync/", views_extra.SocialSyncView.as_view(), name="social-sync"),
    path("social-networks/<int:pk>/revoke/", views_extra.SocialOAuthRevokeView.as_view(), name="social-oauth-revoke"),
    path("social-networks/<int:pk>/videos/", views_extra.SocialVideoListView.as_view(), name="social-videos"),
    path("social-networks/<int:pk>/snapshots/", views_extra.SocialStatsSnapshotListView.as_view(), name="social-snapshots"),
    path("social-networks/<int:pk>/fraud-flags/", views_extra.SocialFraudFlagListView.as_view(), name="social-fraud-flags"),
    path("social/oauth/callback/<str:platform>/", views_extra.SocialOAuthCallbackView.as_view(), name="social-oauth-callback"),
    path("proposals/<int:pk>/tracked-videos/", views_extra.CampaignVideoTrackingListView.as_view(), name="proposal-tracked-videos"),
    path("tracked-videos/<int:pk>/", views_extra.CampaignVideoTrackingDeleteView.as_view(), name="tracked-video-detail"),
    path("social/platforms/", views_extra.SocialPlatformsView.as_view(), name="social-platforms"),

    # ---- Brands ----
    path("brands/<int:pk>/", views.BrandDetailView.as_view(), name="brand-detail"),
    path("brands/profile/", views.BrandProfileUpdateView.as_view(), name="brand-profile-update"),
    path("brands/onboarding/", views_extra.BrandOnboardingStatusView.as_view(), name="brand-onboarding"),
    path("brands/submit-validation/", views_extra.BrandSubmitForValidationView.as_view(), name="brand-submit-validation"),
    path("brands/subscribe/", views.BrandSubscribeView.as_view(), name="brand-subscribe"),  # legacy
    path("brands/subscription/change/", views_extra.BrandSubscriptionChangeView.as_view(), name="brand-subscription-change"),
    path("brands/subscription/cancel/", views_extra.BrandSubscriptionCancelView.as_view(), name="brand-subscription-cancel"),
    path("brands/dashboard/", views.BrandDashboardView.as_view(), name="brand-dashboard"),

    # ---- Campaigns extra actions ----
    path("campaigns/<int:pk>/target/", views.CampaignTargetView.as_view(), name="campaign-target"),
    path("campaigns/<int:pk>/send-proposals/", views.CampaignSendProposalsView.as_view(), name="campaign-send-proposals"),
    path("campaigns/<int:pk>/lookalikes/", views_extra.CampaignLookalikeView.as_view(), name="campaign-lookalikes"),
    path("campaigns/<int:pk>/emv/", views_extra.CampaignEmvView.as_view(), name="campaign-emv"),
    path("campaigns/<int:pk>/export-report/", views_extra.CampaignReportExportView.as_view(), name="campaign-export-report"),
    path("events/<int:pk>/invite/", views.EventInviteView.as_view(), name="event-invite"),
    path("event-invitations/", views.EventInvitationListView.as_view(), name="event-invitations"),
    path("event-invitations/<uuid:invite_token>/", views.EventInvitationDetailByTokenView.as_view(), name="event-invitation-detail-token"),
    path("event-invitations/respond/", views.EventInvitationRespondView.as_view(), name="event-invitation-respond"),
    path("events/check-in/", views.EventCheckInView.as_view(), name="event-check-in"),

    # ---- Casting (CDC §10.5) ----
    path("castings/", views_extra.CastingListView.as_view(), name="casting-list"),
    path("campaigns/<int:pk>/casting/apply/", views_extra.CastingApplyView.as_view(), name="casting-apply"),
    path("campaigns/<int:pk>/casting/applications/", views_extra.CastingApplicationsListView.as_view(), name="casting-applications"),
    path("casting-applications/<int:pk>/decide/", views_extra.CastingApplicationDecisionView.as_view(), name="casting-application-decide"),

    # ---- Proposals ----
    path("proposals/", views.ProposalListView.as_view(), name="proposal-list"),
    path("proposals/<int:pk>/", views.ProposalDetailView.as_view(), name="proposal-detail"),
    path("proposals/<int:pk>/accept/", views.ProposalAcceptView.as_view(), name="proposal-accept"),
    path("proposals/<int:pk>/decline/", views.ProposalDeclineView.as_view(), name="proposal-decline"),
    path("proposals/<int:pk>/counter-offer/", views.ProposalCounterOfferView.as_view(), name="proposal-counter-offer"),
    path("proposals/<int:pk>/accept-counter/", views.ProposalAcceptCounterView.as_view(), name="proposal-accept-counter"),
    path("proposals/<int:pk>/cancel/", views.ProposalCancelView.as_view(), name="proposal-cancel"),
    path("brands/<int:pk>/", views.BrandPublicDetailView.as_view(), name="brand-public-detail"),
    path("proposals/<int:pk>/generate-contract/", views_extra.ProposalGenerateContractView.as_view(), name="proposal-generate-contract"),
    path("proposals/<int:pk>/sign-contract/", views.ProposalSignContractView.as_view(), name="proposal-sign-contract"),
    path("proposals/<int:pk>/sign-session/", views.ProposalSignSessionCreateView.as_view(), name="proposal-sign-session-create"),
    path("sign-sessions/<str:token>/", views.ProposalSignSessionDetailView.as_view(), name="proposal-sign-session-detail"),
    path("sign-sessions/<str:token>/complete/", views.ProposalSignSessionCompleteView.as_view(), name="proposal-sign-session-complete"),
    path("proposals/<int:pk>/fund-escrow/", views.ProposalFundEscrowView.as_view(), name="proposal-fund-escrow"),
    path("proposals/<int:pk>/submit-content/", views.ProposalSubmitContentView.as_view(), name="proposal-submit-content"),
    path("proposals/<int:pk>/latest-submission/", views.ProposalLatestSubmissionView.as_view(), name="proposal-latest-submission"),
    path("proposals/submissions/<int:submission_id>/<str:asset>/", views.ProposalSubmissionAssetView.as_view(), name="proposal-submission-asset"),
    path("proposals/<int:pk>/validate-content/", views.ProposalValidateContentView.as_view(), name="proposal-validate-content"),
    path("proposals/<int:pk>/reject-content/", views.ProposalRejectContentView.as_view(), name="proposal-reject-content"),
    path("proposals/<int:pk>/release-payment/", views.ProposalReleasePaymentView.as_view(), name="proposal-release-payment"),
    path("proposals/<int:pk>/contract/", views.ProposalContractDownloadView.as_view(), name="proposal-contract-download"),
    path("proposals/<int:pk>/messages/", views.MessageListView.as_view(), name="proposal-messages"),
    path("proposals/<int:pk>/messages/send/", views.MessageCreateView.as_view(), name="proposal-messages-send"),
    path("proposals/messages/<int:message_id>/attachment/", views.CampaignMessageAttachmentView.as_view(), name="proposal-message-attachment"),
    path("proposals/<int:pk>/review/", views.ReviewCreateView.as_view(), name="proposal-review"),

    # ---- Direct messages & conversations ----
    path("conversations/", views.ConversationsListView.as_view(), name="conversations-list"),
    path("direct-messages/<int:other_user_id>/", views.DirectMessageListView.as_view(), name="direct-messages"),
    path("direct-messages/send/", views.DirectMessageCreateView.as_view(), name="direct-messages-send"),
    path("direct-messages/<int:message_id>/attachment/", views.DirectMessageAttachmentView.as_view(), name="direct-message-attachment"),

    # ---- Reviews ----
    path("users/<int:pk>/reviews/", views.UserReviewListView.as_view(), name="user-reviews"),

    # ---- Notifications ----
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),

    # ---- Support tickets ----
    path("support/tickets/", views_extra.SupportTicketListCreateView.as_view(), name="support-tickets"),
    path("support/tickets/<int:ticket_pk>/images/", views_extra.SupportTicketImageUploadView.as_view(), name="support-ticket-images"),
    path("support/tickets/images/<int:image_id>/", views_extra.SupportTicketImageDownloadView.as_view(), name="support-ticket-image-download"),
    path("support/tickets/<int:ticket_pk>/followup/", views_extra.SupportTicketFollowUpView.as_view(), name="support-ticket-followup"),
    path("support/tickets/<int:ticket_pk>/rate/", views_extra.SupportTicketRatingView.as_view(), name="support-ticket-rate"),

    # ---- Admin ----
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("admin/campaigns/", views.AdminCampaignListView.as_view(), name="admin-campaigns"),
    path("admin/proposals/", views.AdminProposalListView.as_view(), name="admin-proposals"),
    path("admin/proposals/<int:pk>/arbitrate/", views.AdminArbitrateView.as_view(), name="admin-arbitrate"),
    path("admin/overview/", views_extra.AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/users/<int:pk>/status/", views_extra.AdminUserStatusUpdateView.as_view(), name="admin-user-status-update"),
    path("admin/users/<int:pk>/", views_extra.AdminUserUpdateView.as_view(), name="admin-user-update"),
    path("admin/financials/", views.AdminFinancialsView.as_view(), name="admin-financials"),
    path("admin/settings/", views.AdminSettingsView.as_view(), name="admin-settings"),
    # Brand validation workflow (CDC §5.1)
    path("admin/brands/", views_extra.AdminPendingBrandsView.as_view(), name="admin-brands"),
    path("admin/brands/<int:pk>/", views_extra.AdminBrandUpdateView.as_view(), name="admin-brand-update"),
    path("admin/brands/<int:pk>/approve/", views_extra.AdminBrandApproveView.as_view(), name="admin-brand-approve"),
    path("admin/brands/<int:pk>/reject/", views_extra.AdminBrandRejectView.as_view(), name="admin-brand-reject"),
    # Review moderation
    path("admin/reviews/pending/", views_extra.AdminReviewModerationListView.as_view(), name="admin-reviews-pending"),
    path("admin/reviews/<int:pk>/publish/", views_extra.AdminReviewPublishView.as_view(), name="admin-review-publish"),
    path("admin/reviews/<int:pk>/reject/", views_extra.AdminReviewRejectView.as_view(), name="admin-review-reject"),
    # Subscription plans configuration (features + pricing)
    path("admin/plans/", views_plans.AdminPlanConfigListView.as_view(), name="admin-plans"),
    path("admin/plans/<str:code>/", views_plans.AdminPlanConfigUpdateView.as_view(), name="admin-plan-update"),
    # Audit log
    path("admin/audit-log/", views_extra.AdminAuditLogListView.as_view(), name="admin-audit-log"),
    # Fraud flags (anti-fraud moderation)
    path("admin/fraud-flags/", views_extra.AdminFraudFlagListView.as_view(), name="admin-fraud-flags"),
    path("admin/fraud-flags/<int:pk>/resolve/", views_extra.AdminFraudFlagResolveView.as_view(), name="admin-fraud-flag-resolve"),
    # Support tickets
    path("admin/support/tickets/<int:pk>/", views_extra.AdminSupportTicketUpdateView.as_view(), name="admin-support-ticket-update"),

    # ---- Brand multi-user (memberships) ----
    path("brands/environments/", views_extra.BrandEnvironmentListView.as_view(), name="brand-environments"),
    path("brands/environments/switch/", views_extra.BrandEnvironmentSwitchView.as_view(), name="brand-environment-switch"),
    path("brands/memberships/", views_extra.BrandMembershipListCreateView.as_view(), name="brand-memberships"),
    path("brands/memberships/<int:pk>/", views_extra.BrandMembershipDetailView.as_view(), name="brand-membership-detail"),

    # ---- Team (organization, invitations, global access) ----
    path("brands/team/overview/", views_team_invitations.TeamOverviewView.as_view(), name="brand-team-overview"),
    path("brands/team/invitations/", views_team_invitations.TeamInvitationListCreateView.as_view(), name="brand-team-invitations"),
    path("brands/team/invitations/<int:pk>/action/", views_team_invitations.TeamInvitationActionView.as_view(), name="brand-team-invitation-action"),
    path("brands/team/org-members/<int:pk>/", views_team_invitations.OrganizationMemberDetailView.as_view(), name="brand-team-org-member"),
    path("team/invitations/<str:token>/", views_team_invitations.PublicInvitationDetailView.as_view(), name="team-invitation-detail"),
    path("team/invitations/<str:token>/accept/", views_team_invitations.PublicInvitationAcceptView.as_view(), name="team-invitation-accept"),
    path("team/invitations/<str:token>/register/", views_team_invitations.PublicInvitationRegisterView.as_view(), name="team-invitation-register"),

    # ---- Agency delegations ----
    path("agency/delegations/", views_extra.AgencyDelegationListCreateView.as_view(), name="agency-delegations"),
    path("agency/delegations/<int:pk>/action/", views_extra.AgencyDelegationActionView.as_view(), name="agency-delegation-action"),

    # ---- Stripe webhook (stub) ----
    path("webhooks/stripe/", views_extra.StripeWebhookView.as_view(), name="stripe-webhook"),

    # ---- SSO Office 365 (OIDC) ----
    path("auth/sso/discover/", views_sso.SSOOffice365DiscoverView.as_view(), name="sso-discover"),
    path("auth/sso/office365/start/", views_sso.SSOOffice365StartView.as_view(), name="sso-o365-start"),
    path("auth/sso/office365/callback/", views_sso.SSOOffice365CallbackView.as_view(), name="sso-o365-callback"),
    path("auth/sso/exchange/", views_sso.SSOExchangeView.as_view(), name="sso-exchange"),

    # ---- Brand domains + SSO config ----
    path("v1/brand/domains/", views_sso.BrandDomainListCreateView.as_view(), name="brand-domains"),
    path("v1/brand/domains/<int:pk>/", views_sso.BrandDomainDetailView.as_view(), name="brand-domain-detail"),
    path("v1/brand/domains/<int:pk>/verify/", views_sso.BrandDomainVerifyView.as_view(), name="brand-domain-verify"),
    path("v1/brand/sso/", views_sso.BrandSSOConfigView.as_view(), name="brand-sso-config"),

    # ---- Brand API keys + webhooks management ----
    path("v1/brand/api-keys/", views_api_mgmt.ApiKeyListCreateView.as_view(), name="brand-api-keys"),
    path("v1/brand/api-keys/<int:pk>/", views_api_mgmt.ApiKeyDetailView.as_view(), name="brand-api-key-detail"),
    path("v1/brand/api-keys/audit-log/", views_api_mgmt.ApiKeyAuditLogView.as_view(), name="brand-api-keys-audit"),
    path("v1/brand/webhooks/", views_api_mgmt.WebhookEndpointListCreateView.as_view(), name="brand-webhooks"),
    path("v1/brand/webhooks/<int:pk>/", views_api_mgmt.WebhookEndpointDetailView.as_view(), name="brand-webhook-detail"),
    path("v1/brand/webhooks/<int:pk>/test/", views_api_mgmt.WebhookEndpointTestView.as_view(), name="brand-webhook-test"),
    path("v1/brand/webhooks/<int:pk>/deliveries/", views_api_mgmt.WebhookDeliveryListView.as_view(), name="brand-webhook-deliveries"),

    # ---- Public REST API v1 (API-key authenticated) ----
    path("v1/campaigns/", views_api_v1.V1CampaignListView.as_view(), name="v1-campaigns"),
    path("v1/campaigns/<int:pk>/", views_api_v1.V1CampaignDetailView.as_view(), name="v1-campaign-detail"),
    path("v1/campaigns/create/", views_api_v1.V1CampaignCreateView.as_view(), name="v1-campaign-create"),
    path("v1/campaigns/<int:pk>/status/", views_api_v1.V1CampaignStatusView.as_view(), name="v1-campaign-status"),
    path("v1/campaigns/<int:pk>/report/", views_api_v1.V1CampaignReportView.as_view(), name="v1-campaign-report"),
    path("v1/proposals/", views_api_v1.V1ProposalListView.as_view(), name="v1-proposals"),
    path("v1/proposals/<int:pk>/", views_api_v1.V1ProposalDetailView.as_view(), name="v1-proposal-detail"),
    path("v1/influencers/", views_api_v1.V1InfluencerListView.as_view(), name="v1-influencers"),
    path("v1/influencers/<int:pk>/", views_api_v1.V1InfluencerDetailView.as_view(), name="v1-influencer-detail"),
    path("v1/influencers/<int:pk>/stats/", views_api_v1.V1InfluencerStatsView.as_view(), name="v1-influencer-stats"),
    path("v1/influencers/<int:pk>/verify/", views_api_v1.V1InfluencerVerifyView.as_view(), name="v1-influencer-verify"),
    path("v1/webhooks/", views_api_v1.V1WebhookEndpointListCreateView.as_view(), name="v1-webhooks"),

    # ---- Router URLs ----
    path("", include(router.urls)),
]
