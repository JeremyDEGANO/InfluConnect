"""Office 365 / Microsoft Entra ID OIDC (Authorization Code + PKCE).

Flow:
  1) Frontend (Login or Brand Integrations page) hits POST /auth/sso/office365/start/
     with optional brand_slug or email. Backend resolves the BrandSSOConfig from
     either the verified email domain or the brand_slug, builds the Microsoft
     authorize URL with `state`+`code_challenge` and returns it.
  2) User authenticates on Microsoft. Microsoft redirects to
     GET /auth/sso/office365/callback/?code=...&state=...
  3) Backend validates `state`, exchanges the code with the verifier, validates
     the ID token (signature via JWKS, iss, aud, exp, nonce), enforces the
     email domain is in the BrandDomain verified set, then issues JWTs.

Security:
  * PKCE S256 (mandatory)
  * `state` and `nonce` random 32-byte URL-safe, stored in Django cache 10 min
  * ID token signature validated against tenant JWKS (PyJWT[crypto])
  * `iss` checked against `https://login.microsoftonline.com/<tenant>/v2.0`
  * `aud` must equal client_id
  * Email domain must be in BrandDomain (verified) of the brand
  * Auto-provision only if BrandSSOConfig.auto_provision_users
"""
from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import jwt as pyjwt
import requests
from django.core.cache import cache
from django.utils import timezone

from ..models import BrandDomain, BrandSSOConfig, BrandProfile, User
from . import fernet_service


AUTHORIZE_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
JWKS_URL = "https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys"
ISSUER_URL = "https://login.microsoftonline.com/{tenant}/v2.0"
SCOPES = "openid email profile offline_access"
STATE_TTL = 10 * 60  # 10 min


@dataclass
class StartResult:
    authorize_url: str
    state: str


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _pkce_pair() -> tuple[str, str]:
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def start_login(*, sso: BrandSSOConfig, redirect_uri: str, login_hint: str = "", final_redirect: str = "/", client: str = "web") -> StartResult:
    if not sso.enabled or not sso.tenant_id or not sso.client_id:
        raise ValueError("SSO is not configured for this workspace.")
    state = secrets.token_urlsafe(24)
    nonce = secrets.token_urlsafe(24)
    verifier, challenge = _pkce_pair()
    cache.set(f"sso:state:{state}", {
        "brand_id": sso.brand_id,
        "verifier": verifier,
        "nonce": nonce,
        "redirect_uri": redirect_uri,
        "final_redirect": final_redirect,
        # "mobile" : le callback redirige vers le deep link de l'app au lieu du front web
        "client": client,
        "ts": time.time(),
    }, timeout=STATE_TTL)
    params = {
        "client_id": sso.client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": SCOPES,
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "prompt": "select_account",
    }
    if login_hint:
        params["login_hint"] = login_hint
    url = AUTHORIZE_URL.format(tenant=sso.tenant_id) + "?" + urlencode(params)
    return StartResult(authorize_url=url, state=state)


def exchange_and_validate(*, code: str, state: str, redirect_uri: str) -> dict:
    """Exchange auth code for tokens and validate the ID token. Returns claims."""
    cached = cache.get(f"sso:state:{state}")
    if not cached:
        raise ValueError("Invalid or expired SSO state.")
    cache.delete(f"sso:state:{state}")

    sso = BrandSSOConfig.objects.select_related("brand").filter(brand_id=cached["brand_id"]).first()
    if not sso or not sso.enabled:
        raise ValueError("SSO configuration missing.")
    client_secret = fernet_service.decrypt(sso.client_secret_enc) if sso.client_secret_enc else ""

    token_resp = requests.post(
        TOKEN_URL.format(tenant=sso.tenant_id),
        data={
            "client_id": sso.client_id,
            "scope": SCOPES,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": cached["verifier"],
            "client_secret": client_secret,
        },
        timeout=10,
    )
    if token_resp.status_code != 200:
        raise ValueError(f"Token exchange failed: {token_resp.text[:200]}")
    payload = token_resp.json()
    id_token = payload.get("id_token")
    if not id_token:
        raise ValueError("No id_token in token response.")

    jwks_url = JWKS_URL.format(tenant=sso.tenant_id)
    jwks_client = pyjwt.PyJWKClient(jwks_url)
    signing_key = jwks_client.get_signing_key_from_jwt(id_token).key
    issuer = ISSUER_URL.format(tenant=sso.tenant_id)
    claims = pyjwt.decode(
        id_token,
        signing_key,
        algorithms=["RS256"],
        audience=sso.client_id,
        issuer=issuer,
        options={"require": ["exp", "iat", "iss", "aud"]},
    )
    if cached.get("nonce") and claims.get("nonce") != cached["nonce"]:
        raise ValueError("Invalid nonce.")
    claims["_brand_id"] = sso.brand_id
    claims["_final_redirect"] = cached.get("final_redirect") or "/"
    claims["_client"] = cached.get("client") or "web"
    return claims


def _matched_group_mappings(*, claims: dict, sso: BrandSSOConfig):
    """Mappings whose Entra group GUID appears in the ID token `groups` claim.

    Requires the Entra app registration to emit the groups claim
    (Token configuration → Add groups claim → Security groups).
    """
    mappings = list(sso.group_mappings.prefetch_related("environments"))
    if not mappings:
        raise ValueError("No Entra group is mapped. Ask your admin to map at least one group.")
    token_groups = claims.get("groups")
    if token_groups is None:
        if claims.get("_claim_names", {}).get("groups"):
            # Group overage: too many groups to embed in the token.
            raise ValueError(
                "Too many Entra groups to include in the token. "
                "Restrict the groups claim or use fewer groups."
            )
        raise ValueError(
            "ID token has no 'groups' claim. Enable it in the Entra app registration "
            "(Token configuration → Add groups claim → Security groups)."
        )
    token_set = {str(g).lower() for g in token_groups}
    return [m for m in mappings if m.group_object_id.lower() in token_set]


def _sync_user_access(*, user: User, sso: BrandSSOConfig, matched_mappings=None) -> None:
    """Grant workspace access on every SSO login (idempotent upsert).

    domain mode  → default_role, org-wide or on the config's environment.
    groups mode  → role/scope of each matched group mapping.
    Existing access is never downgraded, only created/upgraded.
    """
    from django.utils import timezone
    from ..models import BrandMembership, OrganizationMembership
    from ..workspace import ensure_brand_organization

    rank = {"member": 1, "admin": 2, "owner": 3}
    org = ensure_brand_organization(sso.brand)

    def grant_global(role: str) -> None:
        membership = OrganizationMembership.objects.filter(organization=org, user=user).first()
        if membership:
            updates = []
            if membership.status != "active":
                membership.status = "active"
                updates.append("status")
            if rank.get(role, 0) > rank.get(membership.role, 0):
                membership.role = role
                updates.append("role")
            if updates:
                membership.save(update_fields=updates + ["updated_at"])
        else:
            OrganizationMembership.objects.create(
                organization=org, user=user, role=role, status="active",
            )

    def grant_env(brand, role: str) -> None:
        membership = BrandMembership.objects.filter(brand=brand, user=user).first()
        if membership:
            updates = []
            if membership.status != "active":
                membership.status = "active"
                updates.append("status")
            if rank.get(role, 0) > rank.get(membership.role, 0):
                membership.role = role
                updates.append("role")
            if updates:
                membership.save(update_fields=updates)
        else:
            BrandMembership.objects.create(
                brand=brand, user=user, invited_email=user.email,
                role=role, status="active", joined_at=timezone.now(),
            )

    if sso.provisioning_mode == "groups":
        for mapping in (matched_mappings or []):
            role = mapping.role if mapping.role in rank else "member"
            if mapping.scope == "global":
                grant_global(role)
            else:
                for env in mapping.environments.all():
                    if env.organization_id == org.id:
                        grant_env(env, role)
    else:
        role = sso.default_role if sso.default_role in ("admin", "member") else "member"
        if sso.apply_to_organization:
            grant_global(role)
        else:
            grant_env(sso.brand, role)


def resolve_or_provision_user(*, claims: dict, sso: BrandSSOConfig) -> User:
    email = (claims.get("email") or claims.get("preferred_username") or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("ID token has no email.")
    domain = email.rsplit("@", 1)[1]
    # The domain may have been verified from any environment of the organization.
    domain_qs = BrandDomain.objects.filter(domain__iexact=domain, status="verified")
    if sso.brand.organization_id:
        verified = domain_qs.filter(brand__organization_id=sso.brand.organization_id).exists()
    else:
        verified = domain_qs.filter(brand=sso.brand).exists()
    if not verified:
        raise ValueError(f"Email domain '{domain}' is not verified for this workspace.")

    # Group gating happens BEFORE any account is created: in 'groups' mode a
    # tenant user outside the mapped groups must not get in at all.
    matched_mappings = None
    if sso.provisioning_mode == "groups":
        matched_mappings = _matched_group_mappings(claims=claims, sso=sso)
        if not matched_mappings:
            raise ValueError("Your account is not a member of an authorized group for this workspace.")

    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        if not sso.auto_provision_users:
            raise ValueError("User not provisioned and auto-provision is disabled.")
        username = email.split("@", 1)[0] + "_" + secrets.token_hex(3)
        user = User.objects.create(
            username=username,
            email=email,
            user_type="brand",
            auth_provider="office365",
            first_name=(claims.get("given_name") or "")[:30],
            last_name=(claims.get("family_name") or "")[:150],
            is_active=True,
        )
        user.set_unusable_password()
        user.save(update_fields=["password"])
    else:
        if user.user_type not in ("brand", "admin"):
            raise ValueError("This email belongs to a non-brand account.")
        if user.auth_provider != "office365":
            user.auth_provider = "office365"
            user.save(update_fields=["auth_provider"])

    # Sync workspace access on every login so group/role changes propagate.
    _sync_user_access(user=user, sso=sso, matched_mappings=matched_mappings)
    return user


def resolve_brand_by_email(email: str) -> Optional[BrandProfile]:
    if "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].strip().lower()
    bd = BrandDomain.objects.filter(domain__iexact=domain, status="verified").select_related("brand").first()
    return bd.brand if bd else None


def resolve_sso_config_by_email(email: str) -> Optional[BrandSSOConfig]:
    """Enabled SSO config for the email's verified domain — looked up on the
    domain's environment first, then on any environment of the same
    organization (one integration covers the whole multi-company client).

    The owning brand's plan is re-checked on every login: SSO stops working
    as soon as the brand downgrades to a plan without SSO (the config is
    kept and works again after an upgrade)."""
    from .plans import has_feature

    brand = resolve_brand_by_email(email)
    if not brand:
        return None
    cfg = BrandSSOConfig.objects.filter(brand=brand, enabled=True).select_related("brand").first()
    if cfg and has_feature(cfg.brand, "sso_office365_google"):
        return cfg
    if brand.organization_id:
        candidates = (
            BrandSSOConfig.objects
            .filter(brand__organization_id=brand.organization_id, enabled=True)
            .select_related("brand")
        )
        for candidate in candidates:
            if has_feature(candidate.brand, "sso_office365_google"):
                return candidate
    return None
