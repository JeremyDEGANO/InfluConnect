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


def start_login(*, sso: BrandSSOConfig, redirect_uri: str, login_hint: str = "", final_redirect: str = "/") -> StartResult:
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
    return claims


def resolve_or_provision_user(*, claims: dict, sso: BrandSSOConfig) -> User:
    email = (claims.get("email") or claims.get("preferred_username") or "").strip().lower()
    if not email or "@" not in email:
        raise ValueError("ID token has no email.")
    domain = email.rsplit("@", 1)[1]
    verified = BrandDomain.objects.filter(brand=sso.brand, domain__iexact=domain, status="verified").exists()
    if not verified:
        raise ValueError(f"Email domain '{domain}' is not verified for this workspace.")

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
        # Optionally attach to brand workspace via BrandMembership; left to admin to formalize.
    else:
        if user.auth_provider != "office365":
            user.auth_provider = "office365"
            user.save(update_fields=["auth_provider"])
    return user


def resolve_brand_by_email(email: str) -> Optional[BrandProfile]:
    if "@" not in email:
        return None
    domain = email.rsplit("@", 1)[1].strip().lower()
    bd = BrandDomain.objects.filter(domain__iexact=domain, status="verified").select_related("brand").first()
    return bd.brand if bd else None
