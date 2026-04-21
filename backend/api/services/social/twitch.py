"""Twitch provider — Twitch OAuth + Helix API."""
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

AUTHORIZE_URL = "https://id.twitch.tv/oauth2/authorize"
TOKEN_URL = "https://id.twitch.tv/oauth2/token"
HELIX = "https://api.twitch.tv/helix"
SCOPES = "user:read:email channel:read:subscriptions"


class TwitchProvider(BaseSocialProvider):
    platform = "twitch"

    def __init__(self):
        self.client_id = getattr(settings, "TWITCH_CLIENT_ID", "")
        self.client_secret = getattr(settings, "TWITCH_CLIENT_SECRET", "")
        if not self.client_id or not self.client_secret:
            raise ProviderConfigMissing("Twitch credentials not configured.")

    def get_authorize_url(self, state: str, redirect_uri: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        res = requests.post(TOKEN_URL, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"Twitch token exchange failed: {res.text}")
        data = res.json()
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            expires_in=data.get("expires_in"),
        )

    def refresh_access_token(self, refresh_token: str) -> TokenBundle:
        res = requests.post(TOKEN_URL, data={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }, timeout=15)
        if res.status_code != 200:
            raise ProviderError(f"Twitch refresh failed: {res.text}")
        data = res.json()
        return TokenBundle(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", refresh_token),
            expires_in=data.get("expires_in"),
        )

    def fetch_stats(self, tokens: TokenBundle) -> StatsBundle:
        headers = {
            "Authorization": f"Bearer {tokens.access_token}",
            "Client-Id": self.client_id,
        }
        # Authenticated user.
        u = requests.get(f"{HELIX}/users", headers=headers, timeout=15)
        if u.status_code != 200:
            raise ProviderError(f"Twitch users failed: {u.text}")
        users = u.json().get("data", [])
        if not users:
            raise ProviderError("Twitch user not found.")
        user = users[0]
        user_id = user["id"]

        # Followers count.
        followers = 0
        try:
            f = requests.get(f"{HELIX}/channels/followers", headers=headers, params={
                "broadcaster_id": user_id,
            }, timeout=15).json()
            followers = int(f.get("total", 0))
        except Exception:
            pass

        # Average viewers from recent videos.
        avg_views = 0
        try:
            v = requests.get(f"{HELIX}/videos", headers=headers, params={
                "user_id": user_id,
                "first": 20,
                "type": "archive",
            }, timeout=15).json().get("data", [])
            if v:
                avg_views = sum(int(x.get("view_count", 0)) for x in v) // len(v)
        except Exception:
            pass

        return StatsBundle(
            followers_count=followers,
            avg_views=avg_views,
            engagement_rate=0.0,  # Twitch doesn't expose easy engagement
            profile_url=f"https://www.twitch.tv/{user.get('login', '')}",
            extra={"login": user.get("login", ""), "display_name": user.get("display_name", "")},
        )
