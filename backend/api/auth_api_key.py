"""DRF authentication class for public API v1 (Bearer ic_live_<id>.<secret>).

Also handles:
  * IP allowlist enforcement (per-key)
  * `last_used_at` / `last_used_ip` book-keeping
  * lightweight audit row creation in `ApiAuditLog` (success at view dispatch,
    failures here at authentication time)
  * scope checks via the `HasApiScope` permission factory
"""
from __future__ import annotations

import ipaddress
import time
from typing import Tuple

from rest_framework import authentication, exceptions, permissions, throttling

from .models import ApiAuditLog, ApiKey
from .services import api_keys as api_keys_service


HEADER_NAME = "HTTP_AUTHORIZATION"
SCHEME = "Bearer"


def _client_ip(request) -> str | None:
    # Rightmost X-Forwarded-For entry: appended by our trusted reverse proxy.
    # Using the leftmost entry would let clients spoof the IP allowlist check.
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR")


def _ip_allowed(ip: str | None, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    if not ip:
        return False
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    for entry in allowlist:
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            else:
                if addr == ipaddress.ip_address(entry):
                    return True
        except ValueError:
            continue
    return False


class ApiKeyAuthentication(authentication.BaseAuthentication):
    keyword = SCHEME

    def authenticate(self, request) -> Tuple | None:
        auth = request.META.get(HEADER_NAME, "")
        if not auth or not auth.startswith(self.keyword + " "):
            return None
        full = auth.split(" ", 1)[1].strip()
        if not full.startswith(api_keys_service.PREFIX_TAG):
            # let other auth classes try (JWT)
            return None
        api_key = api_keys_service.verify(full)
        if not api_key:
            self._log_failure(request, None, 401, "invalid key")
            raise exceptions.AuthenticationFailed("Invalid or revoked API key.")
        # Entitlement is re-checked on every call: a key minted on a higher
        # plan stops working as soon as the brand downgrades to a plan
        # without API access (and works again after an upgrade).
        from .services import plans as plans_service
        if not plans_service.has_feature(api_key.brand, "api_access"):
            self._log_failure(request, api_key, 403, "plan without api access")
            raise exceptions.AuthenticationFailed(
                "API access is not included in your current subscription plan. "
                "Upgrade your plan to re-enable this key."
            )
        ip = _client_ip(request)
        if not _ip_allowed(ip, api_key.ip_allowlist or []):
            self._log_failure(request, api_key, 403, "ip not allowed")
            raise exceptions.AuthenticationFailed("Source IP not allowed for this key.")
        # touch last_used (best-effort)
        try:
            api_keys_service.touch(api_key, ip)
        except Exception:
            pass
        # Return a sentinel user (anonymous, but `request.auth` carries the key)
        from django.contrib.auth.models import AnonymousUser
        return (AnonymousUser(), api_key)

    def authenticate_header(self, request) -> str:
        return self.keyword

    def _log_failure(self, request, key, code: int, msg: str) -> None:
        try:
            ApiAuditLog.objects.create(
                api_key=key,
                brand=getattr(key, "brand", None) if key else None,
                method=request.method[:8],
                path=request.path[:255],
                status_code=code,
                ip_address=_client_ip(request),
                user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255],
                error=msg[:255],
            )
        except Exception:
            pass


class HasApiScope(permissions.BasePermission):
    """Factory-style permission: subclass and set `required_scopes`."""
    required_scopes: list[str] = []

    def has_permission(self, request, view) -> bool:
        key: ApiKey | None = getattr(request, "auth", None) if isinstance(getattr(request, "auth", None), ApiKey) else None
        if key is None:
            return False
        if not self.required_scopes:
            return True
        scopes = set(key.scopes or [])
        return all(s in scopes for s in self.required_scopes)


def scope(*needed: str):
    """Return a HasApiScope subclass requiring the given scopes."""
    name = "HasScope_" + "_".join(s.replace(":", "_") for s in needed)
    return type(name, (HasApiScope,), {"required_scopes": list(needed)})


class ApiKeyRateThrottle(throttling.SimpleRateThrottle):
    """120 req/min per API key (override via DEFAULT_THROTTLE_RATES['api_key'])."""
    scope = "api_key"

    def get_cache_key(self, request, view):
        key = getattr(request, "auth", None)
        if not isinstance(key, ApiKey):
            return None
        return f"throttle:apikey:{key.id}"
