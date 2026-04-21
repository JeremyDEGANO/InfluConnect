"""Base interface for social-network OAuth providers."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


class ProviderConfigMissing(Exception):
    """Raised when client_id/secret are not configured for a platform."""


class ProviderError(Exception):
    """Raised when the remote API returns an unexpected error."""


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str = ""
    expires_in: Optional[int] = None  # seconds
    extra: dict = None  # provider-specific extras (e.g. open_id, page_id)

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


@dataclass
class StatsBundle:
    followers_count: int = 0
    avg_views: int = 0
    engagement_rate: float = 0.0
    profile_url: str = ""
    extra: dict = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


class BaseSocialProvider:
    """Interface implemented by each platform-specific provider."""

    platform: str = ""

    # ---- OAuth ------------------------------------------------------------
    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        raise NotImplementedError

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        raise NotImplementedError

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        """Optional: providers without refresh tokens can leave this as-is."""
        raise NotImplementedError

    # ---- Stats ------------------------------------------------------------
    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        raise NotImplementedError
