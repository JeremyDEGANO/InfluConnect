"""Views: SSO Office 365 + brand domain verification.

Endpoints:
  POST /api/auth/sso/office365/start/
       body: { email?: str, brand_id?: int, final_redirect?: "/path" }
       returns: { authorize_url, state }
  GET  /api/auth/sso/office365/callback/?code=&state=
       302 -> FRONTEND_URL with ?access=...&refresh=... or ?sso_error=...

    GET    /api/v1/brand/domains/
    POST   /api/v1/brand/domains/          body: { domain }
    POST   /api/v1/brand/domains/<id>/verify/
    DELETE /api/v1/brand/domains/<id>/

    GET    /api/v1/brand/sso/
    PUT    /api/v1/brand/sso/              body: full config (incl. client_secret to replace)
"""
from __future__ import annotations

import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import (
    OpenApiExample, OpenApiResponse, extend_schema, inline_serializer,
)
from rest_framework import generics, serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BrandDomain, BrandSSOConfig
from .workspace import get_user_role_for_brand, resolve_active_brand
from .services import dns_verification, sso_office365, fernet_service
from .services import plans as plans_service
from .views import get_tokens_for_user


def _admin_brand(request):
    """Active workspace, restricted to its owner/admin (SSO + domain settings
    control who can log into the workspace — members must not change them)."""
    brand = resolve_active_brand(request.user, request=request)
    if not brand:
        return None
    if get_user_role_for_brand(request.user, brand) not in ("owner", "admin"):
        return None
    return brand


def _absolute_callback_uri(request) -> str:
    return request.build_absolute_uri("/api/auth/sso/office365/callback/")


# ---------------------------------------------------------------------------
# SSO Login flow
# ---------------------------------------------------------------------------
class SSOOffice365DiscoverView(APIView):
    """Tells the login page whether the email's domain is bound to an SSO workspace.

    Public endpoint (no auth). Returns minimal info — never leaks tenant secrets.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        email = (request.GET.get("email") or "").strip().lower()
        if "@" not in email:
            return Response({"sso": False})
        sso = sso_office365.resolve_sso_config_by_email(email)
        if not sso:
            return Response({"sso": False})
        return Response({
            "sso": True,
            "provider": sso.provider,
            "enforce": bool(sso.enforce_sso),
            "brand_name": sso.brand.company_name or "",
        })


class SSOOffice365StartView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        brand_id = request.data.get("brand_id")
        final_redirect = (request.data.get("final_redirect") or "/").strip()
        # L'app mobile (Capacitor) demande un retour par deep link plutôt que
        # vers le front web : le flag voyage dans le state côté cache serveur.
        client = "mobile" if request.data.get("client") == "mobile" else "web"

        sso = None
        if brand_id:
            sso = BrandSSOConfig.objects.filter(brand_id=brand_id, enabled=True).first()
        elif email:
            sso = sso_office365.resolve_sso_config_by_email(email)
        if not sso:
            return Response({"detail": "SSO not configured for this workspace."}, status=404)

        try:
            result = sso_office365.start_login(
                sso=sso,
                redirect_uri=_absolute_callback_uri(request),
                login_hint=email,
                final_redirect=final_redirect,
                client=client,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"authorize_url": result.authorize_url, "state": result.state})


class SSOOffice365CallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        front = settings.FRONTEND_URL.rstrip("/")
        # Flux démarré depuis l'app mobile → retour par deep link (lu avant
        # exchange_and_validate, qui consomme le state).
        scheme = getattr(settings, "MOBILE_APP_SCHEME", "influconnect")
        cached_state = cache.get(f"sso:state:{state}") if state else None
        is_mobile = bool(cached_state) and cached_state.get("client") == "mobile"

        def _redirect(path: str, query: dict):
            if is_mobile:
                return HttpResponseRedirect(f"{scheme}://{path.lstrip('/')}?" + urlencode(query))
            return HttpResponseRedirect(f"{front}{path}?" + urlencode(query))

        if request.GET.get("error"):
            return _redirect("/login", {"sso_error": request.GET.get("error", "")})
        if not code or not state:
            return _redirect("/login", {"sso_error": "missing_params"})
        try:
            claims = sso_office365.exchange_and_validate(
                code=code, state=state, redirect_uri=_absolute_callback_uri(request),
            )
            sso = BrandSSOConfig.objects.select_related("brand").get(brand_id=claims["_brand_id"])
            user = sso_office365.resolve_or_provision_user(claims=claims, sso=sso)
        except Exception as exc:
            return _redirect("/login", {"sso_error": str(exc)[:120]})

        # Never put JWTs in the redirect URL (browser history, proxy logs):
        # hand the frontend a 60s single-use code it exchanges via POST.
        auth_code = secrets.token_urlsafe(32)
        cache.set(
            f"sso:authcode:{auth_code}",
            {"user_id": user.id, "next": claims.get("_final_redirect", "/")},
            timeout=60,
        )
        return _redirect("/login/sso", {"code": auth_code})


class SSOExchangeView(APIView):
    """Exchange the single-use SSO code for JWT tokens (POST body, not URL)."""
    permission_classes = [AllowAny]

    def post(self, request):
        from .models import User
        from .serializers import UserSerializer

        code = (request.data.get("code") or "").strip()
        if not code or len(code) > 64:
            return Response({"detail": "Invalid code."}, status=400)
        cache_key = f"sso:authcode:{code}"
        payload = cache.get(cache_key)
        if not payload:
            return Response({"detail": "Code expired or already used."}, status=400)
        cache.delete(cache_key)  # single use

        user = User.objects.filter(pk=payload["user_id"], is_active=True).first()
        if not user:
            return Response({"detail": "User not found."}, status=400)
        if user.user_type == "brand":
            resolve_active_brand(user, request=request)
        tokens = get_tokens_for_user(user)
        return Response({
            "user": UserSerializer(user, context={"request": request}).data,
            "next": payload.get("next") or "/",
            **tokens,
        })


# ---------------------------------------------------------------------------
# Brand domain CRUD + verify
# ---------------------------------------------------------------------------
def _serialize_domain(d: BrandDomain) -> dict:
    return {
        "id": d.id,
        "domain": d.domain,
        "status": d.status,
        "verification_token": d.verification_token,
        "record_name": dns_verification.expected_record_name(d.domain),
        "record_value": dns_verification.expected_record_value(d.verification_token),
        "verified_at": d.verified_at.isoformat() if d.verified_at else None,
        "last_checked_at": d.last_checked_at.isoformat() if d.last_checked_at else None,
        "last_error": d.last_error,
        "created_at": d.created_at.isoformat(),
    }


_DOMAIN_EXAMPLE = {
    "id": 5, "domain": "acme.com", "status": "verified",
    "verification_token": "a1b2c3d4e5f6",
    "record_name": "_influconnect-challenge.acme.com",
    "record_value": "influconnect-verification=a1b2c3d4e5f6",
    "verified_at": "2025-05-10T11:00:00Z",
    "last_checked_at": "2025-05-10T11:00:00Z",
    "last_error": "", "created_at": "2025-05-10T10:55:00Z",
}


@extend_schema(
    tags=["Brand · Domains"],
    summary="List or add an email domain",
    description=(
        "GET lists the email domains attached to your brand workspace and their verification state "
        "(`pending`, `verified`, `failed`). POST adds a new domain and returns the TXT record you "
        "must publish in DNS to prove ownership: `_influconnect-challenge.<domain>` with value "
        "`influconnect-verification=<token>`."
    ),
    request=inline_serializer(name="BrandDomainCreate", fields={"domain": serializers.CharField()}),
    examples=[OpenApiExample("Request", request_only=True, value={"domain": "acme.com"})],
    responses={
        200: OpenApiResponse(examples=[OpenApiExample("OK", value=[_DOMAIN_EXAMPLE])]),
        201: OpenApiResponse(examples=[OpenApiExample("Created", value={**_DOMAIN_EXAMPLE, "status": "pending", "verified_at": None})]),
        400: OpenApiResponse(description="Invalid or duplicate domain"),
        403: OpenApiResponse(description="No brand workspace on the calling user"),
    },
)
class BrandDomainListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response([], status=200)
        items = [_serialize_domain(d) for d in BrandDomain.objects.filter(brand=brand)]
        return Response(items)

    def post(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=403)
        domain = (request.data.get("domain") or "").strip().lower().lstrip("@")
        if not domain or "." not in domain or " " in domain:
            return Response({"detail": "Invalid domain."}, status=400)
        if BrandDomain.objects.filter(brand=brand, domain=domain).exists():
            return Response({"detail": "Domain already added."}, status=400)
        d = BrandDomain.objects.create(
            brand=brand, domain=domain,
            verification_token=dns_verification.generate_token(),
        )
        return Response(_serialize_domain(d), status=201)


@extend_schema(
    tags=["Brand · Domains"],
    summary="Trigger DNS verification for a domain",
    description=(
        "Resolves the TXT record `_influconnect-challenge.<domain>` and compares it to the "
        "expected `influconnect-verification=<token>` value. On success the domain status "
        "becomes `verified` and `verified_at` is set; SSO can then be enabled."
    ),
    request=None,
    responses={
        200: OpenApiResponse(examples=[OpenApiExample("Verified", value=_DOMAIN_EXAMPLE)]),
        400: OpenApiResponse(examples=[OpenApiExample("DnsFailed", value={**_DOMAIN_EXAMPLE,
            "status": "failed", "last_error": "TXT record not found"})]),
        404: OpenApiResponse(description="Domain not found in your workspace"),
    },
)
class BrandDomainVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        brand = _admin_brand(request)
        d = get_object_or_404(BrandDomain, pk=pk, brand=brand)
        ok, msg = dns_verification.verify_domain(d.domain, d.verification_token)
        d.last_checked_at = timezone.now()
        if ok:
            d.status = "verified"
            d.verified_at = timezone.now()
            d.last_error = ""
        else:
            if d.status != "verified":
                d.status = "failed"
            d.last_error = msg[:500]
        d.save()
        return Response(_serialize_domain(d), status=200 if ok else 400)


@extend_schema(
    tags=["Brand · Domains"],
    summary="Remove a domain",
    description="Detaches the domain from your workspace. SSO discovery will stop matching emails on that domain.",
    responses={204: OpenApiResponse(description="Deleted"), 404: OpenApiResponse(description="Not found")},
)
class BrandDomainDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk: int):
        brand = _admin_brand(request)
        d = get_object_or_404(BrandDomain, pk=pk, brand=brand)
        d.delete()
        return Response(status=204)


# ---------------------------------------------------------------------------
# Brand SSO config
# ---------------------------------------------------------------------------
def _serialize_sso(cfg: BrandSSOConfig | None) -> dict:
    if cfg is None:
        return {"enabled": False, "provider": "office365", "tenant_id": "", "client_id": "",
                "has_client_secret": False, "enforce_sso": False,
                "allow_local_fallback_for_owner": True, "auto_provision_users": False,
                "default_role": "member", "provisioning_mode": "domain",
                "apply_to_organization": True, "group_mappings": []}
    return {
        "enabled": cfg.enabled,
        "provider": cfg.provider,
        "tenant_id": cfg.tenant_id,
        "client_id": cfg.client_id,
        "has_client_secret": bool(cfg.client_secret_enc),
        "enforce_sso": cfg.enforce_sso,
        "allow_local_fallback_for_owner": cfg.allow_local_fallback_for_owner,
        "auto_provision_users": cfg.auto_provision_users,
        "default_role": cfg.default_role,
        "provisioning_mode": cfg.provisioning_mode,
        "apply_to_organization": cfg.apply_to_organization,
        "group_mappings": [
            {
                "id": m.id,
                "group_object_id": m.group_object_id,
                "group_name": m.group_name,
                "role": m.role,
                "scope": m.scope,
                "environment_ids": [e.id for e in m.environments.all()],
            }
            for m in cfg.group_mappings.prefetch_related("environments")
        ],
        "callback_uri": "",
    }


@extend_schema(
    tags=["Brand · SSO"],
    summary="Get or update the SSO (Microsoft Entra ID) configuration",
    description=(
        "GET returns the current SSO config (without the client secret — `has_client_secret` indicates "
        "presence). PUT updates any of: `tenant_id`, `client_id`, `client_secret` (server stores it "
        "encrypted at rest with Fernet), `enforce_sso`, `allow_local_fallback_for_owner`, "
        "`auto_provision_users`, `default_role`, `enabled`.\n\n"
        "Enabling SSO requires (a) tenant_id + client_id + client_secret set, and (b) at least one "
        "verified DNS domain attached to the workspace."
    ),
    request=inline_serializer(name="BrandSSOConfigUpdate", fields={
        "tenant_id": serializers.CharField(required=False),
        "client_id": serializers.CharField(required=False),
        "client_secret": serializers.CharField(required=False, write_only=True),
        "enforce_sso": serializers.BooleanField(required=False),
        "allow_local_fallback_for_owner": serializers.BooleanField(required=False),
        "auto_provision_users": serializers.BooleanField(required=False),
        "default_role": serializers.CharField(required=False),
        "enabled": serializers.BooleanField(required=False),
    }),
    examples=[OpenApiExample("PUT request", request_only=True, value={
        "tenant_id": "11111111-2222-3333-4444-555555555555",
        "client_id": "66666666-7777-8888-9999-000000000000",
        "client_secret": "<new secret value>",
        "enforce_sso": True, "enabled": True,
    })],
    responses={
        200: OpenApiResponse(examples=[OpenApiExample("OK", value={
            "enabled": True, "provider": "office365",
            "tenant_id": "11111111-2222-3333-4444-555555555555",
            "client_id": "66666666-7777-8888-9999-000000000000",
            "has_client_secret": True, "enforce_sso": True,
            "allow_local_fallback_for_owner": True, "auto_provision_users": False,
            "default_role": "member",
            "callback_uri": "https://api.influconnect.app/api/auth/sso/office365/callback/",
        })]),
        400: OpenApiResponse(description="Missing prerequisites to enable SSO"),
        403: OpenApiResponse(description="No brand workspace on the calling user"),
    },
)
class BrandSSOConfigView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=403)
        cfg = BrandSSOConfig.objects.filter(brand=brand).first()
        data = _serialize_sso(cfg)
        data["callback_uri"] = _absolute_callback_uri(request)
        return Response(data)

    def put(self, request):
        brand = _admin_brand(request)
        if not brand:
            return Response({"detail": "No brand workspace."}, status=403)
        plans_service.require_feature(
            brand, "sso_office365_google", "Le SSO n'est pas inclus dans votre abonnement.",
        )
        cfg, _ = BrandSSOConfig.objects.get_or_create(brand=brand)
        d = request.data
        cfg.provider = "office365"
        if "tenant_id" in d:
            cfg.tenant_id = (d.get("tenant_id") or "").strip()
        if "client_id" in d:
            cfg.client_id = (d.get("client_id") or "").strip()
        new_secret = d.get("client_secret")
        if new_secret:
            cfg.client_secret_enc = fernet_service.encrypt(new_secret)
        if "enforce_sso" in d:
            cfg.enforce_sso = bool(d.get("enforce_sso"))
        if "allow_local_fallback_for_owner" in d:
            cfg.allow_local_fallback_for_owner = bool(d.get("allow_local_fallback_for_owner"))
        if "auto_provision_users" in d:
            cfg.auto_provision_users = bool(d.get("auto_provision_users"))
        if "default_role" in d:
            cfg.default_role = (d.get("default_role") or "member")[:20]
        if "provisioning_mode" in d:
            mode = d.get("provisioning_mode") or "domain"
            if mode not in dict(BrandSSOConfig.PROVISIONING_MODE_CHOICES):
                return Response({"detail": "Invalid provisioning_mode."}, status=400)
            cfg.provisioning_mode = mode
        if "apply_to_organization" in d:
            cfg.apply_to_organization = bool(d.get("apply_to_organization"))
        if "group_mappings" in d:
            from .models import SSOGroupMapping
            from .workspace import ensure_brand_organization
            raw = d.get("group_mappings") or []
            if not isinstance(raw, list):
                return Response({"detail": "group_mappings must be a list."}, status=400)
            org = ensure_brand_organization(brand)
            org_env_ids = set(org.environments.values_list("id", flat=True))
            cleaned = []
            for item in raw[:50]:
                gid = (str(item.get("group_object_id") or "")).strip()
                if not gid or len(gid) > 64:
                    return Response({"detail": "Each mapping needs a group_object_id."}, status=400)
                role = item.get("role") or "member"
                scope = item.get("scope") or "global"
                if role not in dict(SSOGroupMapping.ROLE_CHOICES) or scope not in dict(SSOGroupMapping.SCOPE_CHOICES):
                    return Response({"detail": "Invalid role or scope in group mapping."}, status=400)
                env_ids = []
                if scope == "environments":
                    try:
                        env_ids = [int(i) for i in (item.get("environment_ids") or [])]
                    except (TypeError, ValueError):
                        return Response({"detail": "Invalid environment_ids."}, status=400)
                    if not env_ids or not set(env_ids).issubset(org_env_ids):
                        return Response({"detail": "environment_ids must target environments of your organization."}, status=400)
                cleaned.append({
                    "group_object_id": gid,
                    "group_name": (str(item.get("group_name") or ""))[:255],
                    "role": role, "scope": scope, "environment_ids": env_ids,
                })
            cfg.save()  # ensure pk before resetting mappings
            cfg.group_mappings.all().delete()
            for item in cleaned:
                mapping = SSOGroupMapping.objects.create(
                    sso_config=cfg,
                    group_object_id=item["group_object_id"],
                    group_name=item["group_name"],
                    role=item["role"],
                    scope=item["scope"],
                )
                if item["environment_ids"]:
                    mapping.environments.set(item["environment_ids"])
        if "enabled" in d:
            enable = bool(d.get("enabled"))
            if enable:
                if not (cfg.tenant_id and cfg.client_id and cfg.client_secret_enc):
                    return Response({"detail": "Tenant, client_id and client_secret are required to enable SSO."}, status=400)
                domain_qs = BrandDomain.objects.filter(status="verified")
                if brand.organization_id:
                    domain_qs = domain_qs.filter(brand__organization_id=brand.organization_id)
                else:
                    domain_qs = domain_qs.filter(brand=brand)
                if not domain_qs.exists():
                    return Response({"detail": "Verify at least one DNS domain before enabling SSO."}, status=400)
                if cfg.provisioning_mode == "groups" and not cfg.group_mappings.exists():
                    return Response({"detail": "Map at least one Entra group before enabling group-based SSO."}, status=400)
            cfg.enabled = enable
        cfg.save()
        data = _serialize_sso(cfg)
        data["callback_uri"] = _absolute_callback_uri(request)
        return Response(data)
