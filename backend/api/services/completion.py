"""Compute influencer profile completion percentage (CDC §4.2)."""
from __future__ import annotations

from ..constants import (
    INFLUENCER_COMPLETION_WEIGHTS,
    INFLUENCER_MARKETPLACE_REQUIRED_FIELDS,
)


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
    if profile.media_kit_images.exists():
        score += INFLUENCER_COMPLETION_WEIGHTS["media_kit_images"]
    if getattr(profile, "collaboration_pitch", None) and len(profile.collaboration_pitch.strip()) >= 20:
        score += INFLUENCER_COMPLETION_WEIGHTS["collaboration_pitch"]
    if profile.payment_method and profile.payment_details:
        score += INFLUENCER_COMPLETION_WEIGHTS["payment_method"]

    return min(score, 100)


def influencer_field_status(profile) -> dict:
    """Which profile blocks are filled in. Shared by the score and the gate."""
    user = profile.user
    return {
        "avatar": bool(user.avatar),
        "bio": bool(profile.bio and len(profile.bio.strip()) >= 10),
        "display_name": bool(profile.display_name),
        "location": bool(user.location),
        "languages": bool(getattr(profile, "languages", None)),
        "content_themes": bool(profile.content_themes),
        "content_types_offered": bool(profile.content_types_offered),
        "pricing": bool(profile.pricing),
        "social_networks": profile.social_networks.exists(),
        "media_kit_images": profile.media_kit_images.exists(),
        "collaboration_pitch": bool(
            getattr(profile, "collaboration_pitch", None)
            and len(profile.collaboration_pitch.strip()) >= 20
        ),
        "payment_method": bool(profile.payment_method and profile.payment_details),
    }


def is_marketplace_ready(profile) -> bool:
    """Can a brand usefully evaluate this creator?

    Intentionally narrower than the completion score: an influencer without an
    IBAN or a media kit is still worth discovering — those are needed to sign
    and be paid, which is enforced later in the funnel.
    """
    # An unconfirmed address means we cannot reach the creator about a
    # proposal, so the profile is not ready to be pitched.
    if not getattr(profile.user, "email_verified", False):
        return False
    status = influencer_field_status(profile)
    return all(status.get(field) for field in INFLUENCER_MARKETPLACE_REQUIRED_FIELDS)
