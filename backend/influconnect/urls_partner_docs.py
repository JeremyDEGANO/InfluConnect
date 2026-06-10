from django.urls import path

from api import views_sso, views_api_mgmt, views_api_v1


urlpatterns = [
    # Brand workspace integrations (JWT brand/agency context)
    path("api/v1/brand/domains/", views_sso.BrandDomainListCreateView.as_view()),
    path("api/v1/brand/domains/<int:pk>/", views_sso.BrandDomainDetailView.as_view()),
    path("api/v1/brand/domains/<int:pk>/verify/", views_sso.BrandDomainVerifyView.as_view()),
    path("api/v1/brand/sso/", views_sso.BrandSSOConfigView.as_view()),
    path("api/v1/brand/api-keys/", views_api_mgmt.ApiKeyListCreateView.as_view()),
    path("api/v1/brand/api-keys/<int:pk>/", views_api_mgmt.ApiKeyDetailView.as_view()),
    path("api/v1/brand/api-keys/audit-log/", views_api_mgmt.ApiKeyAuditLogView.as_view()),
    path("api/v1/brand/webhooks/", views_api_mgmt.WebhookEndpointListCreateView.as_view()),
    path("api/v1/brand/webhooks/<int:pk>/", views_api_mgmt.WebhookEndpointDetailView.as_view()),
    path("api/v1/brand/webhooks/<int:pk>/test/", views_api_mgmt.WebhookEndpointTestView.as_view()),
    path("api/v1/brand/webhooks/<int:pk>/deliveries/", views_api_mgmt.WebhookDeliveryListView.as_view()),

    # Public partner API (API key auth + workspace scoping)
    path("api/v1/campaigns/", views_api_v1.V1CampaignListView.as_view()),
    path("api/v1/campaigns/<int:pk>/", views_api_v1.V1CampaignDetailView.as_view()),
    path("api/v1/campaigns/create/", views_api_v1.V1CampaignCreateView.as_view()),
    path("api/v1/campaigns/<int:pk>/status/", views_api_v1.V1CampaignStatusView.as_view()),
    path("api/v1/campaigns/<int:pk>/report/", views_api_v1.V1CampaignReportView.as_view()),
    path("api/v1/proposals/", views_api_v1.V1ProposalListView.as_view()),
    path("api/v1/proposals/<int:pk>/", views_api_v1.V1ProposalDetailView.as_view()),
    path("api/v1/influencers/", views_api_v1.V1InfluencerListView.as_view()),
    path("api/v1/influencers/<int:pk>/", views_api_v1.V1InfluencerDetailView.as_view()),
    path("api/v1/influencers/<int:pk>/stats/", views_api_v1.V1InfluencerStatsView.as_view()),
    path("api/v1/influencers/<int:pk>/verify/", views_api_v1.V1InfluencerVerifyView.as_view()),
    path("api/v1/webhooks/", views_api_v1.V1WebhookEndpointListCreateView.as_view()),
]
