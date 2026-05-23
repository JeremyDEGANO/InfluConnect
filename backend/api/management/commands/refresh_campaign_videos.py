"""Refresh per-video stats for active CampaignVideoTracking rows.

For every tracking row that is not frozen and still inside its 30-day window:
  1. Resolve the influencer's SocialNetwork OAuth tokens.
  2. Call provider.fetch_video_stats and upsert today's CampaignVideoDailyStats.
  3. Mark the tracking as frozen when tracking_ends_at is reached.

Usage:
    python manage.py refresh_campaign_videos
    python manage.py refresh_campaign_videos --dry-run
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import CampaignVideoTracking, CampaignVideoDailyStats
from api.services.social import ProviderError, get_provider
from api.services.social.base import TokenBundle
from api.services.social.tokens import decrypt_token, encrypt_token


class Command(BaseCommand):
    help = "Refresh daily stats for tracked campaign videos."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        now = timezone.now()
        today = now.date()

        qs = CampaignVideoTracking.objects.filter(is_frozen=False).select_related(
            "social_network", "proposal__campaign__brand",
        )
        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No active tracked videos."))
            return

        ok = failed = frozen = 0
        for tracking in qs.iterator():
            label = f"[tracking#{tracking.pk} {tracking.platform}:{tracking.external_video_id}]"

            # Freeze if window is over.
            if tracking.tracking_ends_at and tracking.tracking_ends_at <= now:
                if not dry_run:
                    tracking.is_frozen = True
                    tracking.save(update_fields=["is_frozen"])
                frozen += 1
                self.stdout.write(f"{label} frozen (window ended).")
                continue

            sn = tracking.social_network
            if sn is None or not sn.oauth_access_token:
                msg = "no social network or token attached"
                if not dry_run:
                    tracking.last_error = msg
                    tracking.save(update_fields=["last_error"])
                self.stdout.write(self.style.WARNING(f"{label} {msg}."))
                failed += 1
                continue

            try:
                provider = get_provider(sn.platform)
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"{label} provider unavailable: {exc}"))
                failed += 1
                continue

            access_token = decrypt_token(sn.oauth_access_token) or ""
            refresh_token = decrypt_token(sn.oauth_refresh_token) or ""

            # Refresh token if needed.
            if refresh_token and sn.oauth_expires_at and sn.oauth_expires_at <= now:
                try:
                    new_tokens = provider.refresh_access_token(refresh_token)
                    access_token = new_tokens.access_token
                    if not dry_run:
                        sn.oauth_access_token = encrypt_token(new_tokens.access_token)
                        if new_tokens.refresh_token:
                            sn.oauth_refresh_token = encrypt_token(new_tokens.refresh_token)
                        if new_tokens.expires_in:
                            sn.oauth_expires_at = now + timedelta(seconds=int(new_tokens.expires_in))
                        sn.save(update_fields=[
                            "oauth_access_token", "oauth_refresh_token", "oauth_expires_at",
                        ])
                except (NotImplementedError, ProviderError) as exc:
                    msg = f"token refresh failed: {exc}"
                    if not dry_run:
                        tracking.last_error = str(exc)
                        tracking.save(update_fields=["last_error"])
                    self.stdout.write(self.style.ERROR(f"{label} {msg}"))
                    failed += 1
                    continue

            tokens = TokenBundle(access_token=access_token, refresh_token=refresh_token)

            try:
                vs = provider.fetch_video_stats(tokens, tracking.external_video_id)
            except (ProviderError, NotImplementedError) as exc:
                if not dry_run:
                    tracking.last_error = str(exc)[:500]
                    tracking.save(update_fields=["last_error"])
                self.stdout.write(self.style.ERROR(f"{label} fetch_video_stats failed: {exc}"))
                failed += 1
                continue

            views = int(vs.view_count or 0)
            likes = int(vs.like_count or 0)
            comments = int(vs.comment_count or 0)
            shares = int(vs.share_count or 0)
            engagement = Decimal("0")
            if views > 0:
                engagement = Decimal(str(round((likes + comments + shares) / views * 100, 2)))

            if not dry_run:
                if vs.caption and not tracking.caption:
                    tracking.caption = vs.caption[:500]
                if vs.thumbnail_url and not tracking.thumbnail_url:
                    tracking.thumbnail_url = vs.thumbnail_url
                tracking.last_fetched_at = now
                tracking.last_error = ""
                tracking.save(update_fields=[
                    "caption", "thumbnail_url", "last_fetched_at", "last_error",
                ])
                CampaignVideoDailyStats.objects.update_or_create(
                    tracking=tracking,
                    snapshot_date=today,
                    defaults={
                        "view_count": views,
                        "like_count": likes,
                        "comment_count": comments,
                        "share_count": shares,
                        "engagement_rate": engagement,
                    },
                )

            ok += 1
            self.stdout.write(
                f"{label} views={views} likes={likes} engagement={engagement}%"
            )

        suffix = " (dry-run)" if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"Done{suffix}: {ok}/{total} refreshed, {failed} failed, {frozen} frozen."
        ))
