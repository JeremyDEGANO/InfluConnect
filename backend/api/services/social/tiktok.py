"""TikTok provider — TikTok Login Kit + Display API."""
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

AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/"
SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list"


class TikTokProvider(BaseSocialProvider):
    platform = "tiktok"

    def __init__(self):
        self.client_key = getattr(settings, "TIKTOK_CLIENT_KEY", "")
        self.client_secret = getattr(settings, "TIKTOK_CLIENT_SECRET", "")
        if not self.client_key or not self.client_secret:
            raise ProviderConfigMissing("TikTok credentials not configured.")

    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_key": self.client_key,
            "scope": SCOPES,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        res = requests.post(
            TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_key": self.client_key,
                "client_secret": self.client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            timeout=15,
        )
        if res.status_code != 200:
            raise ProviderError(f"TikTok token exchange failed: {res.text}")
        data = res.json()
        if "access_token" not in data:
            raise ProviderError(f"TikTok token exchange returned no token: {data}")
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            expires_in=data.get("expires_in"),
            extra={"open_id": data.get("open_id", "")},
        )

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        res = requests.post(
            TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_key": self.client_key,
                "client_secret": self.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            timeout=15,
        )
        if res.status_code != 200:
            raise ProviderError(f"TikTok refresh failed: {res.text}")
        data = res.json()
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_in=data.get("expires_in"),
        )

    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        headers = {"Authorization": f"Bearer {tokens.access_token}"}
        # User info with stats fields.
        fields = "open_id,union_id,username,display_name,follower_count,following_count,likes_count,video_count,profile_deep_link"
        res = requests.get(
            USER_INFO_URL,
            headers=headers,
            params={"fields": fields},
            timeout=15,
        )
        if res.status_code != 200:
            raise ProviderError(f"TikTok user info failed: {res.text}")
        user = res.json().get("data", {}).get("user", {})
        followers = int(user.get("follower_count", 0))
        likes_total = int(user.get("likes_count", 0))
        video_count = max(int(user.get("video_count", 0)), 1)

        # Engagement: pull recent videos for view stats.
        avg_views = 0
        engagement_rate = 0.0
        try:
            vres = requests.post(
                VIDEO_LIST_URL,
                headers={**headers, "Content-Type": "application/json"},
                params={"fields": "id,view_count,like_count,comment_count,share_count"},
                json={"max_count": 20},
                timeout=15,
            ).json()
            videos = vres.get("data", {}).get("videos", [])
            if videos:
                total_views = sum(int(v.get("view_count", 0)) for v in videos)
                avg_views = total_views // len(videos)
                ratios = []
                for v in videos:
                    views = int(v.get("view_count", 0))
                    if views > 0:
                        likes = int(v.get("like_count", 0))
                        comments = int(v.get("comment_count", 0))
                        shares = int(v.get("share_count", 0))
                        ratios.append((likes + comments + shares) / views)
                if ratios:
                    engagement_rate = round(sum(ratios) / len(ratios) * 100, 2)
        except Exception:
            pass

        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=engagement_rate,
            profile_url=user.get("profile_deep_link") or f"https://www.tiktok.com/@{user.get('username', '')}",
            extra={
                "open_id": user.get("open_id", ""),
                "username": user.get("username", ""),
                "likes_total": likes_total,
            },
        )
