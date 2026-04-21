"""Facebook + Instagram providers — Meta Graph API.

Instagram stats require a Business or Creator account linked to a Facebook Page.
Both providers share the same Meta App credentials (app_id / app_secret).
"""
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

GRAPH = "https://graph.facebook.com/v21.0"
AUTHORIZE_URL = "https://www.facebook.com/v21.0/dialog/oauth"
TOKEN_URL = f"{GRAPH}/oauth/access_token"


def _credentials():
    app_id = getattr(settings, "META_APP_ID", "")
    app_secret = getattr(settings, "META_APP_SECRET", "")
    if not app_id or not app_secret:
        raise ProviderConfigMissing("Meta (Facebook/Instagram) credentials not configured.")
    return app_id, app_secret


def _exchange_code(code: str, redirect_uri: str) -> TokenBundle:
    app_id, app_secret = _credentials()
    res = requests.get(TOKEN_URL, params={
        "client_id": app_id,
        "client_secret": app_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }, timeout=15)
    if res.status_code != 200:
        raise ProviderError(f"Meta token exchange failed: {res.text}")
    data = res.json()

    # Upgrade to a long-lived token (60 days).
    long_res = requests.get(TOKEN_URL, params={
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": data["access_token"],
    }, timeout=15)
    if long_res.status_code == 200:
        data = long_res.json()

    return TokenBundle(
        access_token=data["access_token"],
        expires_in=data.get("expires_in"),
    )


class FacebookProvider(BaseSocialProvider):
    platform = "facebook"
    scopes = "pages_show_list,pages_read_engagement,read_insights"

    def __init__(self):
        _credentials()  # raises if missing

    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        app_id, _ = _credentials()
        params = {
            "client_id": app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": self.scopes,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        return _exchange_code(code, redirect_uri)

    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        # Pull the first managed Facebook Page.
        res = requests.get(f"{GRAPH}/me/accounts", params={
            "access_token": tokens.access_token,
            "fields": "id,name,fan_count,link,access_token",
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"Facebook pages fetch failed: {res.text}")
        pages = res.json().get("data", [])
        if not pages:
            raise ProviderError("No Facebook page is managed by this user.")
        page = pages[0]
        followers = int(page.get("fan_count", 0))

        # Engagement insights (best-effort).
        avg_views = 0
        engagement_rate = 0.0
        try:
            insights = requests.get(f"{GRAPH}/{page['id']}/insights", params={
                "metric": "page_impressions,page_post_engagements",
                "period": "days_28",
                "access_token": page["access_token"],
            }, timeout=15).json().get("data", [])
            metrics = {m["name"]: m["values"][0]["value"] for m in insights if m.get("values")}
            avg_views = int(metrics.get("page_impressions", 0)) // 28
            if followers > 0:
                engagement_rate = round(metrics.get("page_post_engagements", 0) / max(followers, 1) * 100, 2)
        except Exception:
            pass

        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=engagement_rate,
            profile_url=page.get("link", ""),
            extra={"page_id": page["id"], "page_name": page.get("name", "")},
        )


class InstagramProvider(BaseSocialProvider):
    platform = "instagram"
    # Instagram Graph API requires a Page-linked IG Business/Creator account.
    scopes = (
        "instagram_basic,pages_show_list,pages_read_engagement,"
        "instagram_manage_insights,business_management"
    )

    def __init__(self):
        _credentials()

    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        app_id, _ = _credentials()
        params = {
            "client_id": app_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "response_type": "code",
            "scope": self.scopes,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        return _exchange_code(code, redirect_uri)

    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        # Find a page that has an instagram_business_account attached.
        res = requests.get(f"{GRAPH}/me/accounts", params={
            "access_token": tokens.access_token,
            "fields": "id,instagram_business_account,access_token",
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"Instagram pages fetch failed: {res.text}")
        ig_account_id = None
        page_token = tokens.access_token
        for page in res.json().get("data", []):
            ig = page.get("instagram_business_account")
            if ig and ig.get("id"):
                ig_account_id = ig["id"]
                page_token = page.get("access_token") or tokens.access_token
                break
        if not ig_account_id:
            raise ProviderError(
                "No Instagram Business or Creator account is linked to your Facebook Pages."
            )

        info = requests.get(f"{GRAPH}/{ig_account_id}", params={
            "fields": "username,followers_count,media_count,profile_picture_url",
            "access_token": page_token,
        }, timeout=15).json()
        followers = int(info.get("followers_count", 0))

        avg_views = 0
        engagement_rate = 0.0
        try:
            media = requests.get(f"{GRAPH}/{ig_account_id}/media", params={
                "fields": "id,like_count,comments_count,media_product_type",
                "limit": 12,
                "access_token": page_token,
            }, timeout=15).json().get("data", [])
            if media and followers > 0:
                ratios = []
                for m in media:
                    likes = int(m.get("like_count", 0))
                    comments = int(m.get("comments_count", 0))
                    ratios.append((likes + comments) / followers)
                engagement_rate = round(sum(ratios) / len(ratios) * 100, 2)
        except Exception:
            pass

        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=engagement_rate,
            profile_url=f"https://www.instagram.com/{info.get('username', '')}/",
            extra={
                "ig_account_id": ig_account_id,
                "username": info.get("username", ""),
                "media_count": info.get("media_count", 0),
            },
        )
