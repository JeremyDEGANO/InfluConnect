"""Refresh OAuth-connected social network stats and snapshot them daily.

Intended to be run once per day via cron (or a one-off command). For every
SocialNetwork that has stored OAuth tokens it will:

  1. Proactively refresh the access token if it expires within one hour.
  2. Fetch current stats from the provider and apply them to the row.
  3. Upsert a SocialStatsSnapshot for today.

Usage:
    python manage.py refresh_social_stats
    python manage.py refresh_social_stats --platform tiktok
    python manage.py refresh_social_stats --dry-run
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from api.models import SocialNetwork, SocialStatsSnapshot, SocialVideo
from api.services.social import ProviderError, get_provider
from api.services.social.base import TokenBundle
from api.services.social.tokens import decrypt_token, encrypt_token
from api.services.social import fraud as fraud_service


REFRESH_THRESHOLD = timedelta(hours=1)


class Command(BaseCommand):
    help = "Refresh OAuth-connected social network stats and snapshot them daily."

    def add_arguments(self, parser):
        parser.add_argument("--platform", help="Restrict to a single platform (tiktok, meta, twitch...).")
        parser.add_argument("--dry-run", action="store_true", help="Do not write any changes.")

    def handle(self, *args, **options):
        platform_filter = options.get("platform")
        dry_run = options.get("dry_run", False)
        today = timezone.now().date()
        now = timezone.now()

        qs = SocialNetwork.objects.exclude(oauth_access_token="")
        if platform_filter:
            qs = qs.filter(platform=platform_filter)

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No OAuth-connected social networks found."))
            return

        ok = failed = 0
        for sn in qs.iterator():
            label = f"[{sn.platform}#{sn.pk}]"
            try:
                provider = get_provider(sn.platform)
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f"{label} provider unavailable: {exc}"))
                failed += 1
                continue

            access_token = decrypt_token(sn.oauth_access_token) or ""
            refresh_token = decrypt_token(sn.oauth_refresh_token) or ""

            if not access_token:
                self.stdout.write(self.style.WARNING(f"{label} no access token stored, skipping."))
                continue

            # Proactive refresh if expiring within REFRESH_THRESHOLD.
            if refresh_token and sn.oauth_expires_at and sn.oauth_expires_at - now <= REFRESH_THRESHOLD:
                try:
                    new_tokens = provider.refresh_access_token(refresh_token)
                    access_token = new_tokens.access_token
                    if not dry_run:
                        sn.oauth_access_token = encrypt_token(new_tokens.access_token)
                        if new_tokens.refresh_token:
                            sn.oauth_refresh_token = encrypt_token(new_tokens.refresh_token)
                        if new_tokens.expires_in:
                            sn.oauth_expires_at = now + timedelta(seconds=int(new_tokens.expires_in))
                    self.stdout.write(f"{label} access token refreshed.")
                except (NotImplementedError, ProviderError) as exc:
                    self.stdout.write(self.style.ERROR(f"{label} token refresh failed: {exc}"))
                    if not dry_run:
                        sn.verified_via_api = False
                        sn.save(update_fields=["verified_via_api"])
                    failed += 1
                    continue

            tokens = TokenBundle(access_token=access_token, refresh_token=refresh_token, expires_in=None)

            try:
                stats = provider.fetch_stats(tokens)
            except ProviderError as exc:
                self.stdout.write(self.style.ERROR(f"{label} fetch_stats failed: {exc}"))
                if not dry_run:
                    sn.verified_via_api = False
                    sn.save(update_fields=["verified_via_api"])
                failed += 1
                continue

            followers = int(stats.followers_count or 0)
            avg_views = int(stats.avg_views or 0)
            engagement = Decimal(str(stats.engagement_rate or 0))

            if not dry_run:
                sn.followers_count = followers
                sn.avg_views = avg_views
                sn.engagement_rate = engagement
                if stats.profile_url:
                    sn.profile_url = stats.profile_url
                extra = getattr(stats, "extra", {}) or {}
                if extra.get("open_id"):
                    sn.external_user_id = str(extra["open_id"])[:128]
                if extra.get("username"):
                    sn.external_username = str(extra["username"])[:128]
                if extra.get("display_name"):
                    sn.display_name = str(extra["display_name"])[:255]
                if extra.get("avatar_url"):
                    sn.avatar_url = str(extra["avatar_url"])[:600]
                if extra.get("bio") is not None:
                    sn.bio = str(extra.get("bio") or "")
                if "is_verified" in extra:
                    sn.is_verified_external = bool(extra["is_verified"])
                if "video_count" in extra:
                    try:
                        sn.video_count = int(extra["video_count"] or 0)
                    except (TypeError, ValueError):
                        pass
                if "likes_total" in extra:
                    try:
                        sn.total_likes = int(extra["likes_total"] or 0)
                    except (TypeError, ValueError):
                        pass
                sn.last_synced_at = now
                sn.verified_via_api = True
                sn.token_status = "active"
                sn.save()

                SocialStatsSnapshot.objects.update_or_create(
                    social_network=sn,
                    snapshot_date=today,
                    defaults={
                        "followers_count": followers,
                        "avg_views": avg_views,
                        "engagement_rate": engagement,
                        "raw_response": extra,
                    },
                )

                # Upsert recent videos.
                videos = extra.get("videos") or []
                seen = []
                for v in videos:
                    vid = getattr(v, "external_video_id", "") or ""
                    if not vid:
                        continue
                    seen.append(vid)
                    SocialVideo.objects.update_or_create(
                        social_network=sn,
                        external_video_id=vid,
                        defaults={
                            "caption": (v.caption or "")[:500],
                            "thumbnail_url": v.thumbnail_url or "",
                            "video_url": v.video_url or "",
                            "view_count": int(v.view_count or 0),
                            "like_count": int(v.like_count or 0),
                            "comment_count": int(v.comment_count or 0),
                            "share_count": int(v.share_count or 0),
                            "duration_sec": int(v.duration_sec or 0),
                            "published_at": v.published_at,
                        },
                    )
                if seen:
                    sn.videos.exclude(external_video_id__in=seen).delete()

                # Fraud detection (after snapshot + videos are persisted).
                try:
                    fraud_service.evaluate(sn)
                except Exception as exc:  # pragma: no cover — defensive
                    self.stdout.write(self.style.WARNING(f"{label} fraud detector error: {exc}"))

            ok += 1
            self.stdout.write(
                f"{label} followers={followers} avg_views={avg_views} engagement={engagement}%"
            )

        suffix = " (dry-run)" if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"Done{suffix}: {ok}/{total} refreshed, {failed} failed."
        ))
