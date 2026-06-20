"""Brand-side management endpoints for public API keys and webhooks."""
from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiExample, OpenApiResponse, extend_schema, inline_serializer,
)
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ApiAuditLog, ApiKey, WebhookDelivery, WebhookEndpoint
from .services import api_keys as api_keys_service
from .services import plans as plans_service
from .services import webhooks as webhooks_service
from .workspace import get_user_role_for_brand, resolve_active_brand


def _admin_brand(request):
    """Active workspace, but only when the caller is its owner or admin.

    API keys / webhooks grant programmatic access to the whole workspace, so
    plain members must not be able to mint or read them.
    """
    brand = resolve_active_brand(request.user, request=request)
    if not brand:
        return None
    if get_user_role_for_brand(request.user, brand) not in ("owner", "admin"):
        return None
    return brand


# --- Schema helpers ---------------------------------------------------------
_KEY_EXAMPLE = {
    "id": 12, "name": "Production server", "prefix": "ic_live_a1b2c3d4",
    "scopes": ["campaigns:read", "campaigns:write", "webhooks:manage"],
    "ip_allowlist": ["203.0.113.0/24"],
    "last_used_at": "2025-05-23T18:04:12Z", "last_used_ip": "203.0.113.7",
    "expires_at": None, "revoked_at": None,
    "created_at": "2025-05-01T10:00:00Z", "is_active": True,
    "secret": "ic_live_a1b2c3d4.s3cr3t_full_value_returned_only_at_creation",
}
_ENDPOINT_EXAMPLE = {
    "id": 9, "url": "https://your-app.example.com/hooks/influconnect",
    "events": ["proposal.accepted", "campaign.status_changed"],
    "description": "Prod hook", "enabled": True,
    "last_delivery_at": "2025-05-23T11:30:00Z", "last_status": "success",
    "created_at": "2025-05-01T10:00:00Z",
    "secret": "whsec_full_value_returned_only_once",
    "secret_preview": "whsec_a1...",
}


# ---------------------------------------------------------------------------
# API keys
# ---------------------------------------------------------------------------
def _serialize_key(k: ApiKey, *, secret: str | None = None) -> dict:
    return {
        "id": k.id,
        "name": k.name,
        "prefix": k.prefix,
        "scopes": k.scopes,
        "ip_allowlist": k.ip_allowlist,
        "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
        "last_used_ip": k.last_used_ip,
        "expires_at": k.expires_at.isoformat() if k.expires_at else None,
        "revoked_at": k.revoked_at.isoformat() if k.revoked_at else None,
        "created_at": k.created_at.isoformat(),
        "is_active": k.is_active,
        "secret": secret,  # only present at creation
    }


@extend_schema(
    tags=["Brand · API keys"],
    summary="List or create API keys",
    description=(
        "GET returns every API key belonging to your brand workspace (without the secret — "
        "only the prefix `ic_live_xxxxxxxx` is shown). POST issues a brand-new key and returns "
        "the **full secret only once** in the `secret` field. Store it in your vault immediately; "
        "we cannot retrieve it again.\n\n"
        "Each key carries an explicit list of `scopes` (least-privilege) and an optional "
        "`ip_allowlist` of CIDR ranges. Requests from other IPs return HTTP 401."
    ),
    request=inline_serializer(name="ApiKeyCreate", fields={
        "name": serializers.CharField(),
        "scopes": serializers.ListField(child=serializers.CharField()),
        "ip_allowlist": serializers.ListField(child=serializers.CharField(), required=False),
        "expires_at": serializers.DateTimeField(required=False, allow_null=True),
    }),
    examples=[OpenApiExample("Request", request_only=True, value={
        "name": "Production server",
        "scopes": ["campaigns:read", "campaigns:write", "webhooks:manage"],
        "ip_allowlist": ["203.0.113.0/24"],
        "expires_at": None,
    })],
    responses={
        200: OpenApiResponse(description="List of API keys (no secret).",
                             examples=[OpenApiExample("OK", value=[{**_KEY_EXAMPLE, "secret": None}])]),
        201: OpenApiResponse(description="Key issued. The `secret` field appears **only** in this response.",
                             examples=[OpenApiExample("Created", value=_KEY_EXAMPLE)]),
        400: OpenApiResponse(description="Validation error",
                             examples=[OpenApiExample("InvalidScope", value={"detail": "Invalid scopes: ['xyz']"})]),
        403: OpenApiResponse(description="No brand workspace on the calling user."),
    },
)
class ApiKeyListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response([], status=200)
        return Response([_serialize_key(k) for k in ApiKey.objects.filter(brand=brand)])

    def post(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=403)
        plans_service.require_feature(
            brand, "api_access", "L'accès API n'est pas inclus dans votre abonnement.",
        )
        name = (request.data.get("name") or "").strip()
        scopes = request.data.get("scopes") or []
        ip_allowlist = request.data.get("ip_allowlist") or []
        if not name:
            return Response({"detail": "Name is required."}, status=400)
        valid_scopes = {s for s, _ in ApiKey.SCOPE_CHOICES}
        invalid = [s for s in scopes if s not in valid_scopes]
        if invalid:
            return Response({"detail": f"Invalid scopes: {invalid}"}, status=400)
        from datetime import datetime
        expires_at = None
        if request.data.get("expires_at"):
            try:
                expires_at = datetime.fromisoformat(request.data["expires_at"].replace("Z", "+00:00"))
            except Exception:
                return Response({"detail": "Invalid expires_at (ISO 8601 expected)."}, status=400)
        issued = api_keys_service.generate(
            brand=brand, name=name, scopes=scopes,
            created_by=request.user, expires_at=expires_at, ip_allowlist=ip_allowlist,
        )
        return Response(_serialize_key(issued.api_key, secret=issued.full_key), status=201)


@extend_schema(
    tags=["Brand · API keys"],
    summary="Revoke an API key",
    description=(
        "Immediately revokes the key. Existing clients using it will start receiving "
        "HTTP 401 within seconds. This operation is irreversible — issue a new key if needed."
    ),
    responses={204: OpenApiResponse(description="Revoked"), 404: OpenApiResponse(description="Not found in your workspace")},
)
class ApiKeyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk: int):
        brand = _admin_brand(request)
        k = get_object_or_404(ApiKey, pk=pk, brand=brand)
        if not k.revoked_at:
            k.revoked_at = timezone.now()
            k.save(update_fields=["revoked_at"])
        return Response(status=204)


@extend_schema(
    tags=["Brand · API keys"],
    summary="API audit log (last 200 calls)",
    description=(
        "Returns the last 200 authenticated calls made against your brand workspace via API keys: "
        "method, path, status code, source IP, latency and any error. Useful for security audits "
        "and debugging integration issues."
    ),
    responses={
        200: OpenApiResponse(examples=[OpenApiExample("OK", value=[{
            "id": 1, "api_key_prefix": "ic_live_a1b2c3d4",
            "method": "GET", "path": "/api/v1/campaigns/", "status_code": 200,
            "ip": "203.0.113.7", "user_agent": "acme-integration/1.4",
            "latency_ms": 42, "error": "", "created_at": "2025-05-23T18:04:12Z",
        }])]),
    },
)
class ApiKeyAuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response([])
        qs = ApiAuditLog.objects.filter(brand=brand).order_by("-created_at")[:200]
        return Response([
            {
                "id": e.id,
                "api_key_prefix": e.api_key.prefix if e.api_key_id else None,
                "method": e.method,
                "path": e.path,
                "status_code": e.status_code,
                "ip": e.ip_address,
                "user_agent": e.user_agent,
                "latency_ms": e.latency_ms,
                "error": e.error,
                "created_at": e.created_at.isoformat(),
            }
            for e in qs
        ])


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
def _serialize_endpoint(ep: WebhookEndpoint, *, reveal_secret: bool = False) -> dict:
    return {
        "id": ep.id,
        "url": ep.url,
        "events": ep.events,
        "description": ep.description,
        "enabled": ep.enabled,
        "last_delivery_at": ep.last_delivery_at.isoformat() if ep.last_delivery_at else None,
        "last_status": ep.last_status,
        "created_at": ep.created_at.isoformat(),
        "secret": ep.secret if reveal_secret else None,
        "secret_preview": (ep.secret[:8] + "…") if ep.secret else "",
    }


@extend_schema(
    tags=["Brand · Webhooks"],
    summary="List or create a webhook endpoint",
    description=(
        "GET returns every webhook endpoint your brand has registered. "
        "POST registers a new HTTPS endpoint subscribed to a set of `events` and returns "
        "the signing `secret` **only once** — store it server-side, we will never expose it again. "
        "Use it to verify the HMAC-SHA256 signature included in every delivery."
    ),
    request=inline_serializer(name="BrandWebhookEndpointCreate", fields={
        "url": serializers.URLField(),
        "events": serializers.ListField(child=serializers.CharField()),
        "description": serializers.CharField(required=False, allow_blank=True),
        "enabled": serializers.BooleanField(required=False),
    }),
    examples=[OpenApiExample("Request", request_only=True, value={
        "url": "https://your-app.example.com/hooks/influconnect",
        "events": ["proposal.accepted", "campaign.status_changed"],
        "description": "Prod hook", "enabled": True,
    })],
    responses={
        200: OpenApiResponse(examples=[OpenApiExample("OK", value=[{**_ENDPOINT_EXAMPLE, "secret": None}])]),
        201: OpenApiResponse(examples=[OpenApiExample("Created", value=_ENDPOINT_EXAMPLE)]),
        400: OpenApiResponse(description="Validation error (HTTPS required, unknown event names…)"),
    },
)
class WebhookEndpointListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response([])
        return Response([_serialize_endpoint(e) for e in WebhookEndpoint.objects.filter(brand=brand)])

    def post(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=403)
        plans_service.require_feature(
            brand, "api_access", "Les webhooks ne sont pas inclus dans votre abonnement.",
        )
        url = (request.data.get("url") or "").strip()
        url_error = webhooks_service.validate_webhook_url(url)
        if url_error:
            return Response({"detail": url_error}, status=400)
        events = request.data.get("events") or []
        valid = {e for e, _ in WebhookEndpoint.EVENT_CHOICES}
        invalid = [e for e in events if e not in valid]
        if invalid:
            return Response({"detail": f"Invalid events: {invalid}"}, status=400)
        ep = WebhookEndpoint.objects.create(
            brand=brand, url=url,
            secret=webhooks_service.generate_secret(),
            events=list(events),
            description=(request.data.get("description") or "")[:255],
            enabled=bool(request.data.get("enabled", True)),
            created_by=request.user,
        )
        return Response(_serialize_endpoint(ep, reveal_secret=True), status=201)


@extend_schema(
    tags=["Brand · Webhooks"],
    summary="Update or delete a webhook endpoint",
    description=(
        "PATCH updates `url`, `events`, `enabled`, `description`, or rotates the secret "
        "with `{ \"rotate_secret\": true }` (response then includes the new `secret` once). "
        "DELETE removes the endpoint permanently — pending deliveries are dropped."
    ),
    request=inline_serializer(name="BrandWebhookEndpointPatch", fields={
        "url": serializers.URLField(required=False),
        "events": serializers.ListField(child=serializers.CharField(), required=False),
        "enabled": serializers.BooleanField(required=False),
        "description": serializers.CharField(required=False, allow_blank=True),
        "rotate_secret": serializers.BooleanField(required=False),
    }),
    responses={200: OpenApiResponse(examples=[OpenApiExample("OK", value=_ENDPOINT_EXAMPLE)]),
               204: OpenApiResponse(description="Deleted"),
               404: OpenApiResponse(description="Not found in your workspace")},
)
class WebhookEndpointDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk: int):
        brand = _admin_brand(request)
        ep = get_object_or_404(WebhookEndpoint, pk=pk, brand=brand)
        d = request.data
        if "url" in d:
            url = (d.get("url") or "").strip()
            url_error = webhooks_service.validate_webhook_url(url)
            if url_error:
                return Response({"detail": url_error}, status=400)
            ep.url = url
        if "events" in d:
            valid = {e for e, _ in WebhookEndpoint.EVENT_CHOICES}
            invalid = [e for e in (d.get("events") or []) if e not in valid]
            if invalid:
                return Response({"detail": f"Invalid events: {invalid}"}, status=400)
            ep.events = list(d.get("events") or [])
        if "enabled" in d:
            ep.enabled = bool(d.get("enabled"))
        if "description" in d:
            ep.description = (d.get("description") or "")[:255]
        if d.get("rotate_secret"):
            ep.secret = webhooks_service.generate_secret()
        ep.save()
        return Response(_serialize_endpoint(ep, reveal_secret=bool(d.get("rotate_secret"))))

    def delete(self, request, pk: int):
        brand = _admin_brand(request)
        ep = get_object_or_404(WebhookEndpoint, pk=pk, brand=brand)
        ep.delete()
        return Response(status=204)


@extend_schema(
    tags=["Brand · Webhooks"],
    summary="Send a test event",
    description=(
        "Dispatches a synthetic `webhook.test` event to this endpoint (even if it is currently "
        "disabled) so you can validate signature verification and connectivity from your side."
    ),
    request=None,
    responses={200: OpenApiResponse(examples=[OpenApiExample("OK", value={"detail": "Test event dispatched."})])},
)
class WebhookEndpointTestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        brand = _admin_brand(request)
        ep = get_object_or_404(WebhookEndpoint, pk=pk, brand=brand)
        prev_enabled = ep.enabled
        ep.enabled = True
        ep.save(update_fields=["enabled"])
        webhooks_service.dispatch_event(brand=brand, event="webhook.test", data={"message": "ping from InfluConnect"})
        if not prev_enabled:
            ep.enabled = False
            ep.save(update_fields=["enabled"])
        return Response({"detail": "Test event dispatched."})


@extend_schema(
    tags=["Brand · Webhooks"],
    summary="List recent deliveries for an endpoint",
    description=(
        "Last 100 delivery attempts for the endpoint: event name, attempts count, HTTP response "
        "status from your server, error message if any, and next retry timestamp."
    ),
    responses={200: OpenApiResponse(examples=[OpenApiExample("OK", value=[{
        "id": 1001, "event": "proposal.accepted", "status": "success",
        "attempts": 1, "response_status": 200, "next_retry_at": None,
        "delivered_at": "2025-05-23T11:30:02Z", "error": "",
        "created_at": "2025-05-23T11:30:00Z",
    }])])},
)
class WebhookDeliveryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk: int):
        brand = _admin_brand(request)
        ep = get_object_or_404(WebhookEndpoint, pk=pk, brand=brand)
        qs = WebhookDelivery.objects.filter(endpoint=ep).order_by("-created_at")[:100]
        return Response([
            {
                "id": d.id,
                "event": d.event,
                "status": d.status,
                "attempts": d.attempts,
                "response_status": d.response_status,
                "next_retry_at": d.next_retry_at.isoformat() if d.next_retry_at else None,
                "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
                "error": d.error,
                "created_at": d.created_at.isoformat(),
            }
            for d in qs
        ])
