"""API key generation, hashing and verification.

Format: `ic_live_<id>.<secret>` where:
  * `ic_live_` is the visible prefix advertising scope (live/test in future)
  * `<id>` is a random 8 url-safe chars used as ApiKey.prefix (db-indexed)
  * `<secret>` is a random 40 url-safe chars (~240 bits of entropy)

Only SHA-256(secret) is stored in DB. The full key is shown ONCE at creation.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from typing import Optional

from django.utils import timezone

from ..models import ApiKey


PREFIX_TAG = "ic_live_"


@dataclass
class IssuedKey:
    api_key: ApiKey
    full_key: str  # show once


def generate(*, brand, name: str, scopes: list[str], created_by=None, expires_at=None, ip_allowlist: list[str] | None = None) -> IssuedKey:
    pid = secrets.token_urlsafe(6)[:8]
    prefix = f"{PREFIX_TAG}{pid}"
    while ApiKey.objects.filter(prefix=prefix).exists():
        pid = secrets.token_urlsafe(6)[:8]
        prefix = f"{PREFIX_TAG}{pid}"
    secret = secrets.token_urlsafe(40)
    hashed = hashlib.sha256(secret.encode("ascii")).hexdigest()
    obj = ApiKey.objects.create(
        brand=brand,
        name=name[:120],
        prefix=prefix,
        hashed_secret=hashed,
        scopes=list(scopes or []),
        ip_allowlist=list(ip_allowlist or []),
        expires_at=expires_at,
        created_by=created_by,
    )
    return IssuedKey(api_key=obj, full_key=f"{prefix}.{secret}")


def verify(full_key: str) -> Optional[ApiKey]:
    if not full_key or "." not in full_key:
        return None
    prefix, _, secret = full_key.partition(".")
    if not prefix.startswith(PREFIX_TAG):
        return None
    api_key = ApiKey.objects.filter(prefix=prefix).select_related("brand").first()
    if not api_key or not api_key.is_active:
        return None
    expected = api_key.hashed_secret.encode("ascii")
    got = hashlib.sha256(secret.encode("ascii")).hexdigest().encode("ascii")
    if not hmac.compare_digest(expected, got):
        return None
    return api_key


def touch(api_key: ApiKey, ip: str | None) -> None:
    api_key.last_used_at = timezone.now()
    api_key.last_used_ip = ip or None
    api_key.save(update_fields=["last_used_at", "last_used_ip"])
