"""Detect fraud signals after each social stats snapshot.

Heuristics (CDC §10):
  - follower_spike: followers grew >20% vs the snapshot taken 1 day ago.
  - low_engagement: followers >= 5000 AND engagement_rate < 0.5%.
  - zombie_account: no new video published in 60+ days but followers keep moving.

Only one open flag per (social_network, flag_type) at a time.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from ...models import SocialFraudFlag, SocialNetwork, SocialStatsSnapshot

SPIKE_THRESHOLD = Decimal("0.20")  # +20%
LOW_ENGAGEMENT_THRESHOLD = Decimal("0.5")  # %
ZOMBIE_NO_VIDEO_DAYS = 60
MIN_FOLLOWERS_FOR_ENGAGEMENT_CHECK = 5_000


def _open_flag(sn: SocialNetwork, flag_type: str, severity: str, details: dict) -> None:
    existing = SocialFraudFlag.objects.filter(
        social_network=sn, flag_type=flag_type, resolved_at__isnull=True,
    ).first()
    if existing:
        existing.details = details
        existing.severity = severity
        existing.save(update_fields=["details", "severity"])
        return
    SocialFraudFlag.objects.create(
        social_network=sn, flag_type=flag_type, severity=severity, details=details,
    )


def _resolve_flag(sn: SocialNetwork, flag_type: str) -> None:
    SocialFraudFlag.objects.filter(
        social_network=sn, flag_type=flag_type, resolved_at__isnull=True,
    ).update(resolved_at=timezone.now())


def evaluate(sn: SocialNetwork) -> list[str]:
    """Run all detectors for `sn` and return the list of flags raised."""
    raised: list[str] = []

    # Follower spike
    previous = (
        SocialStatsSnapshot.objects
        .filter(social_network=sn)
        .order_by("-snapshot_date")
        .values_list("followers_count", flat=True)[:2]
    )
    previous = list(previous)
    if len(previous) >= 2 and previous[1] > 0:
        delta = (previous[0] - previous[1]) / previous[1]
        if delta >= float(SPIKE_THRESHOLD):
            _open_flag(sn, "follower_spike", "high", {
                "previous": previous[1],
                "current": previous[0],
                "delta_pct": round(delta * 100, 2),
            })
            raised.append("follower_spike")
        else:
            _resolve_flag(sn, "follower_spike")

    # Low engagement
    if sn.followers_count >= MIN_FOLLOWERS_FOR_ENGAGEMENT_CHECK:
        if Decimal(sn.engagement_rate) < LOW_ENGAGEMENT_THRESHOLD:
            _open_flag(sn, "low_engagement", "medium", {
                "followers": sn.followers_count,
                "engagement_rate": str(sn.engagement_rate),
            })
            raised.append("low_engagement")
        else:
            _resolve_flag(sn, "low_engagement")

    # Zombie account
    latest_video = sn.videos.order_by("-published_at").first()
    cutoff = timezone.now() - timedelta(days=ZOMBIE_NO_VIDEO_DAYS)
    if latest_video and latest_video.published_at and latest_video.published_at < cutoff:
        _open_flag(sn, "zombie_account", "low", {
            "last_video_at": latest_video.published_at.isoformat(),
            "days_since": (timezone.now() - latest_video.published_at).days,
        })
        raised.append("zombie_account")
    else:
        _resolve_flag(sn, "zombie_account")

    return raised
