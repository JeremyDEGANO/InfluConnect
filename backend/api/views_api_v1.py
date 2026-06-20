"""Public REST API v1 — authenticated via API keys (ic_live_*).

Conventions:
  * Paths prefixed by /api/v1/
  * Authentication: ApiKeyAuthentication (Bearer ic_live_<id>.<secret>)
  * Permission: api scopes per endpoint (HasApiScope)
  * Throttling: 120 req/min per key (api_key scope) — overridable in settings
  * Pagination: ?page= (default page_size=20, max 100)
  * Errors: { "error": { "code": "...", "message": "..." } }
"""
from __future__ import annotations

import time

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiExample, OpenApiParameter, OpenApiResponse,
    extend_schema, inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth_api_key import ApiKeyAuthentication, ApiKeyRateThrottle, scope
from .models import (
    ApiAuditLog, Campaign, CampaignProposal, InfluencerProfile, BrandProfile,
    SocialNetwork,
)
from .serializers import (
    CampaignSerializer, CampaignProposalSerializer, InfluencerProfileSerializer,
)
from .services import webhooks as webhooks_service


# --- Shared schema helpers --------------------------------------------------
_ERROR_RESPONSE = inline_serializer(
    name="ApiErrorEnvelope",
    fields={"error": inline_serializer(
        name="ApiErrorBody",
        fields={"code": serializers.CharField(), "message": serializers.CharField()},
    )},
)
_ERR_401 = OpenApiResponse(
    response=_ERROR_RESPONSE,
    description="Missing, invalid, expired or IP-blocked API key.",
    examples=[OpenApiExample("Unauthorized", value={"error": {"code": "unauthorized", "message": "Invalid API key"}})],
)
_ERR_403 = OpenApiResponse(
    response=_ERROR_RESPONSE,
    description="API key is valid but lacks the required scope.",
    examples=[OpenApiExample("Forbidden", value={"error": {"code": "insufficient_scope", "message": "Required scope: campaigns:write"}})],
)
_ERR_404 = OpenApiResponse(
    response=_ERROR_RESPONSE,
    description="Resource not found or not owned by your brand workspace.",
    examples=[OpenApiExample("NotFound", value={"error": {"code": "not_found", "message": "Campaign 42 not found"}})],
)
_ERR_429 = OpenApiResponse(
    response=_ERROR_RESPONSE,
    description="Rate limit exceeded (120 req/min/key by default).",
    examples=[OpenApiExample("Throttled", value={"error": {"code": "throttled", "message": "Request was throttled. Retry in 32s"}})],
)


class V1Pagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class V1Base(APIView):
    """Base class wiring API-key auth + audit logging."""
    authentication_classes = [ApiKeyAuthentication]
    throttle_classes = [ApiKeyRateThrottle]
    pagination_class = V1Pagination

    def initial(self, request, *args, **kwargs):
        request._v1_started = time.time()
        super().initial(request, *args, **kwargs)

    def finalize_response(self, request, response, *args, **kwargs):
        resp = super().finalize_response(request, response, *args, **kwargs)
        try:
            api_key = getattr(request, "auth", None)
            ApiAuditLog.objects.create(
                api_key=api_key if hasattr(api_key, "prefix") else None,
                brand=getattr(api_key, "brand", None) if hasattr(api_key, "brand") else None,
                method=request.method[:8],
                path=request.path[:255],
                status_code=resp.status_code,
                ip_address=request.META.get("REMOTE_ADDR"),
                user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
                latency_ms=int((time.time() - getattr(request, "_v1_started", time.time())) * 1000),
            )
        except Exception:
            pass
        return resp

    def brand(self, request) -> BrandProfile:
        return request.auth.brand


def _paginate(view: V1Base, queryset, serializer_class):
    paginator = view.pagination_class()
    page = paginator.paginate_queryset(queryset, view.request, view=view)
    if page is None:
        return Response(serializer_class(queryset, many=True).data)
    return paginator.get_paginated_response(serializer_class(page, many=True).data)


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------
_CAMPAIGN_EXAMPLE = {
    "id": 42, "title": "Summer launch", "description": "Beauty creators in France",
    "budget": "5000.00", "deadline": "2025-08-30", "status": "active",
    "content_formats": ["video", "story"], "max_influencers": 10,
    "brand": 7, "created_at": "2025-05-01T10:12:00Z",
}


@extend_schema(
    tags=["Campaigns"],
    summary="List campaigns",
    description=(
        "Returns the paginated list of campaigns owned by your brand workspace. "
        "Optionally filter by `status` (draft, active, paused, completed, archived). "
        "Each campaign is scoped to the authenticated API key's brand — other brands' "
        "campaigns are never returned."
    ),
    parameters=[
        OpenApiParameter("status", str, OpenApiParameter.QUERY, required=False,
                         description="Filter on campaign status"),
        OpenApiParameter("page", int, OpenApiParameter.QUERY, required=False, description="Page number (default 1)"),
        OpenApiParameter("page_size", int, OpenApiParameter.QUERY, required=False,
                         description="Items per page (default 20, max 100)"),
    ],
    responses={
        200: OpenApiResponse(
            response=CampaignSerializer(many=True),
            description="Paginated list of campaigns.",
            examples=[OpenApiExample("OK", value={
                "count": 1, "next": None, "previous": None,
                "results": [_CAMPAIGN_EXAMPLE],
            })],
        ),
        401: _ERR_401, 403: _ERR_403, 429: _ERR_429,
    },
)
class V1CampaignListView(V1Base):
    permission_classes = [scope("campaigns:read")]

    def get(self, request):
        qs = Campaign.objects.filter(brand=self.brand(request)).order_by("-created_at")
        s = (request.GET.get("status") or "").strip()
        if s:
            qs = qs.filter(status=s)
        return _paginate(self, qs, CampaignSerializer)


@extend_schema(
    tags=["Campaigns"],
    summary="Retrieve a campaign",
    description="Fetch one campaign by id. Returns 404 if it does not belong to your brand workspace.",
    responses={
        200: OpenApiResponse(response=CampaignSerializer, examples=[OpenApiExample("OK", value=_CAMPAIGN_EXAMPLE)]),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1CampaignDetailView(V1Base):
    permission_classes = [scope("campaigns:read")]

    def get(self, request, pk: int):
        c = get_object_or_404(Campaign, pk=pk, brand=self.brand(request))
        return Response(CampaignSerializer(c).data)


@extend_schema(
    tags=["Campaigns"],
    summary="Create a campaign",
    description=(
        "Creates a new campaign attached to your brand workspace. "
        "`budget` is a decimal string in EUR. `content_formats` accepts: "
        "`video`, `story`, `post`, `reel`, `short`. The created campaign starts "
        "in status `draft` unless you immediately update it via `/campaigns/{id}/status/`."
    ),
    request=CampaignSerializer,
    examples=[OpenApiExample("Request", request_only=True, value={
        "title": "Summer launch",
        "description": "Beauty creators in France",
        "budget": "5000.00",
        "deadline": "2025-08-30",
        "content_formats": ["video", "story"],
        "max_influencers": 10,
    })],
    responses={
        201: OpenApiResponse(response=CampaignSerializer, examples=[OpenApiExample("Created", value=_CAMPAIGN_EXAMPLE)]),
        400: OpenApiResponse(response=_ERROR_RESPONSE, description="Validation error"),
        401: _ERR_401, 403: _ERR_403,
    },
)
class V1CampaignCreateView(V1Base):
    permission_classes = [scope("campaigns:write")]

    def post(self, request):
        data = request.data.copy()
        s = CampaignSerializer(data=data, context={"request": request})
        s.is_valid(raise_exception=True)
        campaign = s.save(brand=self.brand(request))
        return Response(CampaignSerializer(campaign).data, status=201)


@extend_schema(
    tags=["Campaigns"],
    summary="Change a campaign status",
    description=(
        "Updates the campaign lifecycle status. Valid transitions emit a "
        "`campaign.status_changed` webhook event with `{ campaign_id, from, to }`. "
        "Use this to pause/resume/complete a campaign from your tooling."
    ),
    request=inline_serializer(name="CampaignStatusUpdate", fields={"status": serializers.CharField()}),
    examples=[OpenApiExample("Request", request_only=True, value={"status": "paused"})],
    responses={
        200: OpenApiResponse(response=CampaignSerializer, examples=[OpenApiExample("OK", value={**_CAMPAIGN_EXAMPLE, "status": "paused"})]),
        400: OpenApiResponse(response=_ERROR_RESPONSE,
                             examples=[OpenApiExample("InvalidStatus", value={"error": {"code": "invalid_status", "message": "Unknown status"}})]),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1CampaignStatusView(V1Base):
    permission_classes = [scope("campaigns:write")]

    def patch(self, request, pk: int):
        c = get_object_or_404(Campaign, pk=pk, brand=self.brand(request))
        new_status = (request.data.get("status") or "").strip()
        valid = {s for s, _ in Campaign.STATUS_CHOICES}
        if new_status not in valid:
            return Response({"error": {"code": "invalid_status", "message": "Unknown status"}}, status=400)
        old = c.status
        c.status = new_status
        c.save(update_fields=["status"])
        webhooks_service.dispatch_event(brand=c.brand, event="campaign.status_changed",
                                        data={"campaign_id": c.id, "from": old, "to": new_status})
        return Response(CampaignSerializer(c).data)


# ---------------------------------------------------------------------------
# Proposals
# ---------------------------------------------------------------------------
_PROPOSAL_EXAMPLE = {
    "id": 314, "campaign": 42, "influencer": 91, "status": "accepted",
    "price": "450.00", "message": "Happy to collaborate!",
    "created_at": "2025-05-05T15:20:00Z",
}


@extend_schema(
    tags=["Proposals"],
    summary="List proposals",
    description=(
        "Paginated list of campaign proposals received by your brand. "
        "Filter by `campaign_id` and / or `status` (pending, accepted, declined, "
        "counter_offer, completed). Only proposals attached to your campaigns are returned."
    ),
    parameters=[
        OpenApiParameter("campaign_id", int, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("status", str, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("page", int, OpenApiParameter.QUERY, required=False),
    ],
    responses={
        200: OpenApiResponse(
            response=CampaignProposalSerializer(many=True),
            examples=[OpenApiExample("OK", value={
                "count": 1, "next": None, "previous": None,
                "results": [_PROPOSAL_EXAMPLE],
            })],
        ),
        401: _ERR_401, 403: _ERR_403, 429: _ERR_429,
    },
)
class V1ProposalListView(V1Base):
    permission_classes = [scope("proposals:read")]

    def get(self, request):
        qs = CampaignProposal.objects.filter(campaign__brand=self.brand(request)).order_by("-created_at")
        cid = request.GET.get("campaign_id")
        if cid:
            qs = qs.filter(campaign_id=cid)
        st = request.GET.get("status")
        if st:
            qs = qs.filter(status=st)
        return _paginate(self, qs, CampaignProposalSerializer)


@extend_schema(
    tags=["Proposals"],
    summary="Retrieve a proposal",
    description="Returns the full proposal payload (influencer, price, status, attached deliverables).",
    responses={
        200: OpenApiResponse(response=CampaignProposalSerializer, examples=[OpenApiExample("OK", value=_PROPOSAL_EXAMPLE)]),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1ProposalDetailView(V1Base):
    permission_classes = [scope("proposals:read")]

    def get(self, request, pk: int):
        p = get_object_or_404(CampaignProposal, pk=pk, campaign__brand=self.brand(request))
        return Response(CampaignProposalSerializer(p).data)


# ---------------------------------------------------------------------------
# Influencers (read-only marketplace + verify trigger)
# ---------------------------------------------------------------------------
_INFLUENCER_EXAMPLE = {
    "id": 91, "display_name": "Alex Beauty", "bio": "Skincare, FR",
    "content_themes": ["beauty", "lifestyle"], "is_verified": True,
    "average_rating": 4.8, "country": "FR",
}
_INFLUENCER_STATS_EXAMPLE = {
    "influencer_id": 91, "average_rating": 4.8, "is_verified": True,
    "social_networks": [{
        "platform": "instagram", "followers": 124300, "avg_views": 38000,
        "engagement_rate": 4.2, "video_count": 87, "verified_external": True,
        "last_synced_at": "2025-05-20T07:00:00Z",
    }],
}


@extend_schema(
    tags=["Influencers"],
    summary="Discover influencers",
    description=(
        "Marketplace search. Filter by `theme` (single content theme tag) and "
        "`min_followers` (minimum follower count on any connected social network)."
    ),
    parameters=[
        OpenApiParameter("theme", str, OpenApiParameter.QUERY, required=False,
                         description="e.g. beauty, fitness, gaming"),
        OpenApiParameter("min_followers", int, OpenApiParameter.QUERY, required=False),
        OpenApiParameter("page", int, OpenApiParameter.QUERY, required=False),
    ],
    responses={
        200: OpenApiResponse(
            response=InfluencerProfileSerializer(many=True),
            examples=[OpenApiExample("OK", value={
                "count": 1, "next": None, "previous": None,
                "results": [_INFLUENCER_EXAMPLE],
            })],
        ),
        401: _ERR_401, 403: _ERR_403, 429: _ERR_429,
    },
)
class V1InfluencerListView(V1Base):
    permission_classes = [scope("influencers:read")]

    def get(self, request):
        qs = InfluencerProfile.objects.filter(user__is_active=True).order_by("-id")
        theme = request.GET.get("theme")
        if theme:
            qs = qs.filter(content_themes__contains=[theme])
        min_followers = request.GET.get("min_followers")
        if min_followers and min_followers.isdigit():
            sn_ids = SocialNetwork.objects.filter(followers_count__gte=int(min_followers)).values_list("influencer_id", flat=True)
            qs = qs.filter(id__in=list(sn_ids))
        return _paginate(self, qs, InfluencerProfileSerializer)


@extend_schema(
    tags=["Influencers"],
    summary="Retrieve an influencer profile",
    description="Public marketplace profile (display name, bio, themes, rating, verification flag).",
    responses={
        200: OpenApiResponse(response=InfluencerProfileSerializer, examples=[OpenApiExample("OK", value=_INFLUENCER_EXAMPLE)]),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1InfluencerDetailView(V1Base):
    permission_classes = [scope("influencers:read")]

    def get(self, request, pk: int):
        i = get_object_or_404(InfluencerProfile, pk=pk)
        return Response(InfluencerProfileSerializer(i).data)


@extend_schema(
    tags=["Influencers"],
    summary="Audience & engagement stats",
    description=(
        "Per-network performance snapshot: followers, average views, engagement rate, video count, "
        "and last sync timestamp. Use this for media-kit style scoring before sending a proposal."
    ),
    responses={
        200: OpenApiResponse(
            response=inline_serializer(name="InfluencerStats", fields={
                "influencer_id": serializers.IntegerField(),
                "average_rating": serializers.FloatField(),
                "is_verified": serializers.BooleanField(),
                "social_networks": serializers.ListField(child=serializers.DictField()),
            }),
            examples=[OpenApiExample("OK", value=_INFLUENCER_STATS_EXAMPLE)],
        ),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1InfluencerStatsView(V1Base):
    permission_classes = [scope("influencers:read")]

    def get(self, request, pk: int):
        i = get_object_or_404(InfluencerProfile, pk=pk)
        networks = []
        for sn in i.social_networks.all():
            networks.append({
                "platform": sn.platform,
                "followers": sn.followers_count,
                "avg_views": sn.avg_views,
                "engagement_rate": float(sn.engagement_rate),
                "video_count": sn.video_count,
                "verified_external": sn.is_verified_external,
                "last_synced_at": sn.last_synced_at.isoformat() if sn.last_synced_at else None,
            })
        return Response({
            "influencer_id": i.id,
            "average_rating": float(i.average_rating),
            "is_verified": i.is_verified,
            "social_networks": networks,
        })


@extend_schema(
    tags=["Influencers"],
    summary="Trigger an influencer verification check",
    description=(
        "Runs the deterministic verification pipeline against the influencer's connected accounts. "
        "If the status transitions from unverified to verified, an `influencer.verified` webhook "
        "event is emitted to your registered endpoints."
    ),
    request=None,
    responses={
        200: OpenApiResponse(
            response=inline_serializer(name="InfluencerVerification", fields={
                "influencer_id": serializers.IntegerField(),
                "is_verified": serializers.BooleanField(),
                "checks": serializers.DictField(),
            }),
            examples=[OpenApiExample("OK", value={
                "influencer_id": 91, "is_verified": True,
                "checks": {"has_oauth_connected_socials": True,
                           "has_payment_method": True, "onboarding_completed": True},
            })],
        ),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1InfluencerVerifyView(V1Base):
    """Request a re-verification of the influencer's identity/social proof."""
    permission_classes = [scope("influencers:verify")]

    def post(self, request, pk: int):
        i = get_object_or_404(InfluencerProfile, pk=pk)
        had_verified_socials = i.social_networks.filter(verified_via_api=True).exists()
        previously_verified = i.is_verified
        # Lightweight rule: mark verified if at least one social network is connected
        # via the platform's OAuth and active.
        if had_verified_socials and not previously_verified:
            i.is_verified = True
            i.save(update_fields=["is_verified"])
            try:
                webhooks_service.dispatch_event(
                    brand=self.brand(request), event="influencer.verified",
                    data={"influencer_id": i.id, "verified_at": timezone.now().isoformat()},
                )
            except Exception:
                pass
        return Response({
            "influencer_id": i.id,
            "is_verified": i.is_verified,
            "checks": {
                "has_oauth_connected_socials": had_verified_socials,
                "has_payment_method": bool(i.payment_method),
                "onboarding_completed": i.onboarding_completed,
            },
        })


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------
@extend_schema(
    tags=["Reporting"],
    summary="Campaign performance report",
    description=(
        "Aggregated KPIs for a single campaign: number of proposals received, accepted, "
        "and completed. Use this to feed your BI dashboards."
    ),
    responses={
        200: OpenApiResponse(
            response=inline_serializer(name="CampaignReport", fields={
                "campaign_id": serializers.IntegerField(),
                "status": serializers.CharField(),
                "proposals": serializers.DictField(),
            }),
            examples=[OpenApiExample("OK", value={
                "campaign_id": 42, "status": "active",
                "proposals": {"total": 12, "accepted": 5, "completed": 3},
            })],
        ),
        401: _ERR_401, 403: _ERR_403, 404: _ERR_404,
    },
)
class V1CampaignReportView(V1Base):
    permission_classes = [scope("reporting:read")]

    def get(self, request, pk: int):
        c = get_object_or_404(Campaign, pk=pk, brand=self.brand(request))
        from django.db.models import Sum, Count
        props = CampaignProposal.objects.filter(campaign=c)
        agg = props.aggregate(total_count=Count("id"))
        accepted = props.filter(status="accepted").count()
        completed = props.filter(status="completed").count()
        return Response({
            "campaign_id": c.id,
            "status": c.status,
            "proposals": {
                "total": agg["total_count"] or 0,
                "accepted": accepted,
                "completed": completed,
            },
        })


# ---------------------------------------------------------------------------
# Webhooks management via API (parity with the UI)
# ---------------------------------------------------------------------------
_WEBHOOK_EXAMPLE = {
    "id": 9, "url": "https://your-app.example.com/hooks/influconnect",
    "events": ["proposal.accepted", "campaign.status_changed"],
    "description": "Prod hook", "enabled": True,
    "last_delivery_at": None, "last_status": "",
    "created_at": "2025-05-22T09:00:00Z",
    "secret": "whsec_a1b2c3d4...",  # only returned at creation
    "secret_preview": "whsec_a1...",
}


@extend_schema(
    tags=["Webhooks"],
    summary="List or create a webhook endpoint",
    description=(
        "GET returns every webhook endpoint registered by your brand. "
        "POST registers a new HTTPS endpoint and returns the signing secret "
        "**only this once** — store it securely on your side; we never expose it again."
    ),
    request=inline_serializer(name="WebhookEndpointCreate", fields={
        "url": serializers.URLField(),
        "events": serializers.ListField(child=serializers.CharField()),
        "description": serializers.CharField(required=False, allow_blank=True),
    }),
    examples=[OpenApiExample("Request", request_only=True, value={
        "url": "https://your-app.example.com/hooks/influconnect",
        "events": ["proposal.accepted", "campaign.status_changed"],
        "description": "Prod hook",
    })],
    responses={
        200: OpenApiResponse(description="List of endpoints",
                             examples=[OpenApiExample("OK", value=[_WEBHOOK_EXAMPLE])]),
        201: OpenApiResponse(description="Endpoint created (secret returned once)",
                             examples=[OpenApiExample("Created", value=_WEBHOOK_EXAMPLE)]),
        400: OpenApiResponse(response=_ERROR_RESPONSE,
                             examples=[OpenApiExample("InvalidUrl", value={"error": {"code": "invalid_url", "message": "HTTPS required"}})]),
        401: _ERR_401, 403: _ERR_403,
    },
)
class V1WebhookEndpointListCreateView(V1Base):
    permission_classes = [scope("webhooks:manage")]

    def get(self, request):
        from .views_api_mgmt import _serialize_endpoint
        from .models import WebhookEndpoint
        return Response([_serialize_endpoint(e) for e in WebhookEndpoint.objects.filter(brand=self.brand(request))])

    def post(self, request):
        from .views_api_mgmt import _serialize_endpoint
        from .models import WebhookEndpoint
        url = (request.data.get("url") or "").strip()
        url_error = webhooks_service.validate_webhook_url(url)
        if url_error:
            return Response({"error": {"code": "invalid_url", "message": url_error}}, status=400)
        events = request.data.get("events") or []
        valid = {e for e, _ in WebhookEndpoint.EVENT_CHOICES}
        invalid = [e for e in events if e not in valid]
        if invalid:
            return Response({"error": {"code": "invalid_events", "message": f"Invalid events: {invalid}"}}, status=400)
        ep = WebhookEndpoint.objects.create(
            brand=self.brand(request), url=url,
            secret=webhooks_service.generate_secret(),
            events=list(events),
            description=(request.data.get("description") or "")[:255],
            enabled=True,
        )
        return Response(_serialize_endpoint(ep, reveal_secret=True), status=201)
