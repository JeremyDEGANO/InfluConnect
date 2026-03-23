from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register(r"influencers/social-networks", views.SocialNetworkViewSet, basename="social-network")
router.register(r"campaigns", views.CampaignViewSet, basename="campaign")

urlpatterns = [
    # Auth
    path("auth/register/", views.RegisterView.as_view(), name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),

    # Influencers
    path("influencers/", views.InfluencerListView.as_view(), name="influencer-list"),
    path("influencers/profile/", views.InfluencerProfileUpdateView.as_view(), name="influencer-profile-update"),
    path("influencers/dashboard/", views.InfluencerDashboardView.as_view(), name="influencer-dashboard"),
    path("influencers/<int:pk>/", views.InfluencerDetailView.as_view(), name="influencer-detail"),

    # Brands
    path("brands/<int:pk>/", views.BrandDetailView.as_view(), name="brand-detail"),
    path("brands/profile/", views.BrandProfileUpdateView.as_view(), name="brand-profile-update"),
    path("brands/subscribe/", views.BrandSubscribeView.as_view(), name="brand-subscribe"),
    path("brands/dashboard/", views.BrandDashboardView.as_view(), name="brand-dashboard"),

    # Campaigns (extra actions beyond the router)
    path("campaigns/<int:pk>/target/", views.CampaignTargetView.as_view(), name="campaign-target"),
    path("campaigns/<int:pk>/send-proposals/", views.CampaignSendProposalsView.as_view(), name="campaign-send-proposals"),

    # Proposals
    path("proposals/", views.ProposalListView.as_view(), name="proposal-list"),
    path("proposals/<int:pk>/", views.ProposalDetailView.as_view(), name="proposal-detail"),
    path("proposals/<int:pk>/accept/", views.ProposalAcceptView.as_view(), name="proposal-accept"),
    path("proposals/<int:pk>/decline/", views.ProposalDeclineView.as_view(), name="proposal-decline"),
    path("proposals/<int:pk>/counter-offer/", views.ProposalCounterOfferView.as_view(), name="proposal-counter-offer"),
    path("proposals/<int:pk>/accept-counter/", views.ProposalAcceptCounterView.as_view(), name="proposal-accept-counter"),
    path("proposals/<int:pk>/sign-contract/", views.ProposalSignContractView.as_view(), name="proposal-sign-contract"),
    path("proposals/<int:pk>/fund-escrow/", views.ProposalFundEscrowView.as_view(), name="proposal-fund-escrow"),
    path("proposals/<int:pk>/submit-content/", views.ProposalSubmitContentView.as_view(), name="proposal-submit-content"),
    path("proposals/<int:pk>/validate-content/", views.ProposalValidateContentView.as_view(), name="proposal-validate-content"),
    path("proposals/<int:pk>/reject-content/", views.ProposalRejectContentView.as_view(), name="proposal-reject-content"),
    path("proposals/<int:pk>/release-payment/", views.ProposalReleasePaymentView.as_view(), name="proposal-release-payment"),
    path("proposals/<int:pk>/messages/", views.MessageListView.as_view(), name="proposal-messages"),
    path("proposals/<int:pk>/messages/send/", views.MessageCreateView.as_view(), name="proposal-messages-send"),
    path("proposals/<int:pk>/review/", views.ReviewCreateView.as_view(), name="proposal-review"),

    # Reviews
    path("users/<int:pk>/reviews/", views.UserReviewListView.as_view(), name="user-reviews"),

    # Notifications
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/<int:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notification-read-all"),

    # Admin
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("admin/campaigns/", views.AdminCampaignListView.as_view(), name="admin-campaigns"),
    path("admin/proposals/", views.AdminProposalListView.as_view(), name="admin-proposals"),
    path("admin/proposals/<int:pk>/arbitrate/", views.AdminArbitrateView.as_view(), name="admin-arbitrate"),
    path("admin/financials/", views.AdminFinancialsView.as_view(), name="admin-financials"),
    path("admin/settings/", views.AdminSettingsView.as_view(), name="admin-settings"),

    # Router URLs (social networks + campaigns CRUD)
    path("", include(router.urls)),
]
