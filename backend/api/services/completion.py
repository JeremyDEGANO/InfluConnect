"""Compute influencer profile completion percentage (CDC §4.2)."""
from __future__ import annotations

from ..constants import INFLUENCER_COMPLETION_WEIGHTS


def compute_influencer_completion(profile) -> int:
    """Returns 0-100. Mirrors INFLUENCER_COMPLETION_WEIGHTS."""
    user = profile.user
    score = 0

    if user.avatar:
        score += INFLUENCER_COMPLETION_WEIGHTS["avatar"]
    if profile.bio and len(profile.bio.strip()) >= 10:
        score += INFLUENCER_COMPLETION_WEIGHTS["bio"]
    if profile.display_name:
        score += INFLUENCER_COMPLETION_WEIGHTS["display_name"]
    if user.location:
        score += INFLUENCER_COMPLETION_WEIGHTS["location"]
    if getattr(profile, "languages", None):
        score += INFLUENCER_COMPLETION_WEIGHTS["languages"]
    if profile.content_themes:
        score += INFLUENCER_COMPLETION_WEIGHTS["content_themes"]
    if profile.content_types_offered:
        score += INFLUENCER_COMPLETION_WEIGHTS["content_types_offered"]
    if profile.pricing:
        score += INFLUENCER_COMPLETION_WEIGHTS["pricing"]
    if profile.social_networks.exists():
        score += INFLUENCER_COMPLETION_WEIGHTS["social_networks"]
    if profile.payment_method and profile.payment_details:
        score += INFLUENCER_COMPLETION_WEIGHTS["payment_method"]

    return min(score, 100)
