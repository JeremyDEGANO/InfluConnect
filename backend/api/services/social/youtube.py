"""YouTube provider — Google OAuth 2.0 + YouTube Data API v3."""
from __future__ import annotations

from urllib.parse import urlencode

import requests
from django.conf import settings

from .base import (
    BaseSocialProvider,
    ProviderConfigMissing,
    ProviderError,
    StatsBundle,
    TokenBundle,
)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"
SCOPES = "https://www.googleapis.com/auth/youtube.readonly"


class YouTubeProvider(BaseSocialProvider):
    platform = "youtube"

    def __init__(self):
        self.client_id = getattr(settings, "YOUTUBE_CLIENT_ID", "")
        self.client_secret = getattr(settings, "YOUTUBE_CLIENT_SECRET", "")
        if not self.client_id or not self.client_secret:
            raise ProviderConfigMissing("YouTube credentials not configured.")

    # ---- OAuth ------------------------------------------------------------
    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        res = requests.post(TOKEN_URL, data={
            "code": code,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"YouTube token exchange failed: {res.text}")
        data = res.json()
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            expires_in=data.get("expires_in"),
        )

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        res = requests.post(TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"YouTube refresh failed: {res.text}")
        data = res.json()
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=refresh_token,
            expires_in=data.get("expires_in"),
        )

    # ---- Stats ------------------------------------------------------------
    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        headers = {"Authorization": f"Bearer {tokens.access_token}"}
        # Channel statistics for the authenticated user.
        res = requests.get(CHANNELS_URL, headers=headers, params={
            "part": "snippet,statistics",
            "mine": "true",
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"YouTube channels fetch failed: {res.text}")
        items = res.json().get("items", [])
        if not items:
            raise ProviderError("YouTube channel not found for this user.")
        ch = items[0]
        stats = ch.get("statistics", {})
        followers = int(stats.get("subscriberCount", 0))
        total_views = int(stats.get("viewCount", 0))
        video_count = max(int(stats.get("videoCount", 0)), 1)
        avg_views = total_views // video_count

        # Engagement: pull the 10 most recent videos and average likes/views.
        engagement_rate = 0.0
        try:
            search = requests.get(SEARCH_URL, headers=headers, params={
                "part": "id",
                "channelId": ch["id"],
                "order": "date",
                "maxResults": 10,
                "type": "video",
            }, timeout=15).json()
            video_ids = [it["id"]["videoId"] for it in search.get("items", []) if "videoId" in it.get("id", {})]
            if video_ids:
                videos = requests.get(VIDEOS_URL, headers=headers, params={
                    "part": "statistics",
                    "id": ",".join(video_ids),
                }, timeout=15).json()
                ratios = []
                for v in videos.get("items", []):
                    s = v.get("statistics", {})
                    views = int(s.get("viewCount", 0))
                    likes = int(s.get("likeCount", 0))
                    comments = int(s.get("commentCount", 0))
                    if views > 0:
                        ratios.append((likes + comments) / views)
                if ratios:
                    engagement_rate = round(sum(ratios) / len(ratios) * 100, 2)
        except Exception:
            pass  # engagement is best-effort

        handle = ch.get("snippet", {}).get("customUrl") or ch["id"]
        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=engagement_rate,
            profile_url=f"https://www.youtube.com/channel/{ch['id']}",
            extra={"channel_id": ch["id"], "handle": handle, "title": ch.get("snippet", {}).get("title", "")},
        )
