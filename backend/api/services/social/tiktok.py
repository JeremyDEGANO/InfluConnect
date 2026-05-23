"""TikTok provider — TikTok Login Kit + Display API."""
from __future__ import annotations

from datetime import datetime, timezone as dt_tz
from urllib.parse import urlencode

import requests
from django.conf import settings

from .base import (
    BaseSocialProvider,
    ProviderConfigMissing,
    ProviderError,
    StatsBundle,
    TokenBundle,
    VideoStats,
)

AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/"
VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/"
SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list"

VIDEO_FIELDS = (
    "id,title,video_description,duration,cover_image_url,embed_link,share_url,"
    "create_time,view_count,like_count,comment_count,share_count"
)


def _video_from_payload(v: dict) -> VideoStats:
    created = v.get("create_time")
    published_at = None
    if created:
        try:
            published_at = datetime.fromtimestamp(int(created), tz=dt_tz.utc)
        except (TypeError, ValueError):
            published_at = None
    return VideoStats(
        external_video_id=str(v.get("id", "")),
        view_count=int(v.get("view_count", 0) or 0),
        like_count=int(v.get("like_count", 0) or 0),
        comment_count=int(v.get("comment_count", 0) or 0),
        share_count=int(v.get("share_count", 0) or 0),
        caption=(v.get("title") or v.get("video_description") or "")[:500],
        thumbnail_url=v.get("cover_image_url", "") or "",
        video_url=v.get("share_url") or v.get("embed_link") or "",
        duration_sec=int(v.get("duration", 0) or 0),
        published_at=published_at,
    )


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
        fields = "open_id,union_id,username,display_name,bio_description,is_verified,avatar_url,follower_count,following_count,likes_count,video_count,profile_deep_link"
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
        video_count_total = int(user.get("video_count", 0))

        # Engagement: pull recent videos for view stats.
        avg_views = 0
        engagement_rate = 0.0
        videos_payload = []
        try:
            vres = requests.post(
                VIDEO_LIST_URL,
                headers={**headers, "Content-Type": "application/json"},
                params={"fields": VIDEO_FIELDS},
                json={"max_count": 20},
                timeout=15,
            ).json()
            videos_payload = vres.get("data", {}).get("videos", []) or []
            if videos_payload:
                total_views = sum(int(v.get("view_count", 0)) for v in videos_payload)
                avg_views = total_views // len(videos_payload)
                ratios = []
                for v in videos_payload:
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

        username = user.get("username", "")
        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=engagement_rate,
            profile_url=(f"https://www.tiktok.com/@{username}" if username else user.get("profile_deep_link", "")),
            extra={
                "open_id": user.get("open_id", ""),
                "username": username,
                "display_name": user.get("display_name", ""),
                "avatar_url": user.get("avatar_url", ""),
                "bio": user.get("bio_description", "") or "",
                "is_verified": bool(user.get("is_verified", False)),
                "likes_total": likes_total,
                "video_count": video_count_total,
                "videos": [_video_from_payload(v) for v in videos_payload],
            },
        )

    def fetch_recent_videos(self, tokens: TokenBundle, limit: int = 20):
        headers = {
            "Authorization": f"Bearer {tokens.access_token}",
            "Content-Type": "application/json",
        }
        res = requests.post(
            VIDEO_LIST_URL,
            headers=headers,
            params={"fields": VIDEO_FIELDS},
            json={"max_count": max(1, min(20, limit))},
            timeout=15,
        )
        if res.status_code != 200:
            raise ProviderError(f"TikTok video list failed: {res.text}")
        videos = res.json().get("data", {}).get("videos", []) or []
        return [_video_from_payload(v) for v in videos]

    def fetch_video_stats(self, tokens: TokenBundle, external_video_id: str) -> VideoStats:
        headers = {
            "Authorization": f"Bearer {tokens.access_token}",
            "Content-Type": "application/json",
        }
        res = requests.post(
            VIDEO_QUERY_URL,
            headers=headers,
            params={"fields": VIDEO_FIELDS},
            json={"filters": {"video_ids": [str(external_video_id)]}},
            timeout=15,
        )
        if res.status_code != 200:
            raise ProviderError(f"TikTok video query failed: {res.text}")
        videos = res.json().get("data", {}).get("videos", []) or []
        if not videos:
            raise ProviderError(f"TikTok video not found: {external_video_id}")
        return _video_from_payload(videos[0])
