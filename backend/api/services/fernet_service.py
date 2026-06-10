"""Thin wrapper around Fernet for symmetric encryption of small secrets.

Reads `FERNET_KEY` from Django settings; if empty we still allow callers to
encrypt/decrypt for dev (uses a derived static key). In production the env var
MUST be set to a 32-byte url-safe base64 key.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _resolve_key() -> bytes:
    key = (getattr(settings, "FERNET_KEY", "") or "").strip()
    if key:
        return key.encode("ascii")
    # Dev fallback derived from SECRET_KEY — NEVER rely on this in prod.
    digest = hashlib.sha256((settings.SECRET_KEY or "dev").encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _f() -> Fernet:
    return Fernet(_resolve_key())


def encrypt(plain: str) -> str:
    if plain is None:
        return ""
    return _f().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    if not token:
        return ""
    try:
        return _f().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return ""
