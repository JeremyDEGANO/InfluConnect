from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views, views_extra
from . import views_auth

router = DefaultRouter()
router.register(r"influencers/social-networks", views.SocialNetworkViewSet, basename="social-network")
router.register(r"campaigns", views.CampaignViewSet, basename="campaign")
router.register(r"ambassador-programs", views_extra.AmbassadorProgramViewSet, basename="ambassador-program")
router.register(r"influencers/media-kit-images", views_extra.MediaKitImageViewSet, basename="media-kit-image")
router.register(r"contract-templates", views_extra.ContractTemplateViewSet, basename="contract-template")

urlpatterns = [
    # ---- Auth ----
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/2fa/setup/", views_auth.TOTPSetupView.as_view(), name="2fa-setup"),
    path("auth/2fa/confirm/", views_auth.TOTPConfirmView.as_view(), name="2fa-confirm"),
    path("auth/2fa/disable/", views_auth.TOTPDisableView.as_view(), name="2fa-disable"),
    path("auth/password-reset/", views_auth.PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset-confirm/", views_auth.PasswordResetConfirmView.as_view(), name="password-reset-confirm"),

    # ---- Reference data (public) ----
    path("reference/plans/", views_extra.SubscriptionPlansView.as_view(), name="plans"),
    path("reference/data/", views_extra.ReferenceDataView.as_view(), name="reference-data"),
    path("stripe/config/", views_extra.StripeConfigView.as_view(), name="stripe-config"),
    path("public/marketplace/", views_extra.PublicMarketplaceView.as_view(), name="public-marketplace"),

    # ---- Influencers ----
    path("influencers/", views.InfluencerListView.as_view(), name="influencer-list"),
    path("influencers/profile/", views.InfluencerProfileUpdateView.as_view(), name="influencer-profile-update"),
    path("influencers/dashboard/", views.InfluencerDashboardView.as_view(), name="influencer-dashboard"),
    path("influencers/onboarding/", views_extra.InfluencerOnboardingStatusView.as_view(), name="influencer-onboarding"),
    path("influencers/media-kit/generate/", views_extra.MediaKitGenerateView.as_view(), name="media-kit-generate"),
    path("influencers/stripe-onboard/", views_extra.InfluencerStripeOnboardView.as_view(), name="influencer-stripe-onboard"),
    path("influencers/<int:pk>/", views.InfluencerDetailView.as_view(), name="influencer-detail"),

    # Social network OAuth (stub)
    path("social-networks/<int:pk>/oauth-start/", views_extra.SocialOAuthStartView.as_view(), name="social-oauth-start"),
    path("social-networks/<int:pk>/sync/", views_extra.SocialSyncView.as_view(), name="social-sync"),
    path("social/oauth/callback/<str:platform>/", views_extra.SocialOAuthCallbackView.as_view(), name="social-oauth-callback"),
    path("social/platforms/", views_extra.SocialPlatformsView.as_view(), name="social-platforms"),

    # ---- Brands ----
    path("brands/<int:pk>/", views.BrandDetailView.as_view(), name="brand-detail"),
    path("brands/profile/", views.BrandProfileUpdateView.as_view(), name="brand-profile-update"),
    path("brands/subscribe/", views.BrandSubscribeView.as_view(), name="brand-subscribe"),  # legacy
    path("brands/subscription/change/", views_extra.BrandSubscriptionChangeView.as_view(), name="brand-subscription-change"),
    path("brands/subscription/cancel/", views_extra.BrandSubscriptionCancelView.as_view(), name="brand-subscription-cancel"),
    path("brands/dashboard/", views.BrandDashboardView.as_view(), name="brand-dashboard"),

    # ---- Campaigns extra actions ----
    path("campaigns/<int:pk>/target/", views.CampaignTargetView.as_view(), name="campaign-target"),
    path("campaigns/<int:pk>/send-proposals/", views.CampaignSendProposalsView.as_view(), name="campaign-send-proposals"),

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
    path("proposals/<int:pk>/fund-escrow/", views.ProposalFundEscrowView.as_view(), name="proposal-fund-escrow"),
    path("proposals/<int:pk>/submit-content/", views.ProposalSubmitContentView.as_view(), name="proposal-submit-content"),
    path("proposals/<int:pk>/validate-content/", views.ProposalValidateContentView.as_view(), name="proposal-validate-content"),
    path("proposals/<int:pk>/reject-content/", views.ProposalRejectContentView.as_view(), name="proposal-reject-content"),
    path("proposals/<int:pk>/release-payment/", views.ProposalReleasePaymentView.as_view(), name="proposal-release-payment"),
    path("proposals/<int:pk>/messages/", views.MessageListView.as_view(), name="proposal-messages"),
    path("proposals/<int:pk>/messages/send/", views.MessageCreateView.as_view(), name="proposal-messages-send"),
    path("proposals/<int:pk>/review/", views.ReviewCreateView.as_view(), name="proposal-review"),

    # ---- Reviews ----
    path("users/<int:pk>/reviews/", views.UserReviewListView.as_view(), name="user-reviews"),

    # ---- Notifications ----
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),

    # ---- Admin ----
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("admin/campaigns/", views.AdminCampaignListView.as_view(), name="admin-campaigns"),
    path("admin/proposals/", views.AdminProposalListView.as_view(), name="admin-proposals"),
    path("admin/proposals/<int:pk>/arbitrate/", views.AdminArbitrateView.as_view(), name="admin-arbitrate"),
    path("admin/financials/", views.AdminFinancialsView.as_view(), name="admin-financials"),
    path("admin/settings/", views.AdminSettingsView.as_view(), name="admin-settings"),
    # Brand validation workflow (CDC §5.1)
    path("admin/brands/", views_extra.AdminPendingBrandsView.as_view(), name="admin-brands"),
    path("admin/brands/<int:pk>/approve/", views_extra.AdminBrandApproveView.as_view(), name="admin-brand-approve"),
    path("admin/brands/<int:pk>/reject/", views_extra.AdminBrandRejectView.as_view(), name="admin-brand-reject"),
    # Review moderation
    path("admin/reviews/pending/", views_extra.AdminReviewModerationListView.as_view(), name="admin-reviews-pending"),
    path("admin/reviews/<int:pk>/publish/", views_extra.AdminReviewPublishView.as_view(), name="admin-review-publish"),
    path("admin/reviews/<int:pk>/reject/", views_extra.AdminReviewRejectView.as_view(), name="admin-review-reject"),
    # Audit log
    path("admin/audit-log/", views_extra.AdminAuditLogListView.as_view(), name="admin-audit-log"),

    # ---- Stripe webhook (stub) ----
    path("webhooks/stripe/", views_extra.StripeWebhookView.as_view(), name="stripe-webhook"),

    # ---- Router URLs ----
    path("", include(router.urls)),
]
