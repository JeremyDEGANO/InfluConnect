"""Provider registry — returns the right provider class for a platform."""
from __future__ import annotations

from typing import Optional

from .base import BaseSocialProvider, ProviderConfigMissing


def get_provider(platform: str) -> Optional[BaseSocialProvider]:
    """Return a configured provider instance, or None if not configured."""
    try:
        if platform == "youtube":
            from .youtube import YouTubeProvider
            return YouTubeProvider()
        if platform == "tiktok":
            from .tiktok import TikTokProvider
            return TikTokProvider()
        if platform == "instagram":
            from .meta import InstagramProvider
            return InstagramProvider()
        if platform == "facebook":
            from .meta import FacebookProvider
            return FacebookProvider()
        if platform == "twitch":
            from .twitch import TwitchProvider
            return TwitchProvider()
    except ProviderConfigMissing:
        return None
    return None


def available_platforms() -> list[str]:
    """List of platforms that currently have credentials configured."""
    return [p for p in ("youtube", "tiktok", "instagram", "facebook", "twitch")
            if get_provider(p) is not None]
