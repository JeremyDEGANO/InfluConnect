"""Social network OAuth providers + stats sync.

Each provider implements the BaseSocialProvider interface (see base.py).
Credentials are read from settings (env vars). When credentials are missing,
get_provider() returns None so callers can fall back to the legacy stub flow.
"""
from .base import BaseSocialProvider, ProviderConfigMissing, ProviderError
from .registry import get_provider, available_platforms

__all__ = [
    "BaseSocialProvider",
    "ProviderConfigMissing",
    "ProviderError",
    "get_provider",
    "available_platforms",
]
