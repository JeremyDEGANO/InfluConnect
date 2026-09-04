"""In-process scheduler for the recurring jobs.

The production image runs as an unprivileged user with no cron daemon, so the
periodic commands (social stats, campaign video tracking) were never actually
running - stats only refreshed when someone clicked "sync" by hand. This command
is the missing scheduler: run it as its own long-lived service alongside
gunicorn (see the `scheduler` service in docker-compose.prod.yml).

It is deliberately dependency-free (no Celery/beat/Redis): one loop, one
process, jobs invoked through `call_command` exactly as an operator would.

Usage:
    python manage.py run_scheduler
    python manage.py run_scheduler --once          # run everything due, then exit
    python manage.py run_scheduler --tick 300      # check every 5 minutes
"""
from __future__ import annotations

import signal
import time
from dataclasses import dataclass, field
from datetime import timedelta
from typing import Callable

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone

import logging

logger = logging.getLogger(__name__)


@dataclass
class Job:
    """A recurring job and how often it should run."""
    name: str
    every: timedelta
    run: Callable[[], None]
    #: Only run when the local hour matches (None = any hour).
    at_hour: int | None = None
    last_run: object = field(default=None, init=False)

    def is_due(self, now) -> bool:
        if self.at_hour is not None:
            if now.hour != self.at_hour:
                return False
            # Once per day at the target hour.
            return self.last_run is None or (now - self.last_run) >= timedelta(hours=23)
        return self.last_run is None or (now - self.last_run) >= self.every


class Command(BaseCommand):
    help = "Run the recurring background jobs (social stats, video tracking) on a loop."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true",
                            help="Run every due job once and exit (useful for an external cron).")
        parser.add_argument("--tick", type=int, default=300,
                            help="Seconds between due-checks (default: 300).")
        parser.add_argument("--stats-hour", type=int, default=4,
                            help="Local hour to refresh social stats at (default: 4).")

    def handle(self, *args, **options):
        once = options["once"]
        tick = max(30, int(options["tick"]))
        stats_hour = int(options["stats_hour"]) % 24

        jobs = [
            # Provider APIs are rate-limited and stats move slowly: once a day,
            # off-peak, is the right cadence.
            Job(
                name="refresh_social_stats",
                every=timedelta(days=1),
                at_hour=None if once else stats_hour,
                run=lambda: call_command("refresh_social_stats"),
            ),
            # Campaign videos are inside a 30-day tracking window, so they need
            # a daily point to draw a curve.
            Job(
                name="refresh_campaign_videos",
                every=timedelta(days=1),
                at_hour=None if once else (stats_hour + 1) % 24,
                run=lambda: call_command("refresh_campaign_videos"),
            ),
        ]

        if once:
            for job in jobs:
                self._run(job)
            self._say(self.style.SUCCESS("Scheduler: all jobs ran once."))
            return

        stopping = {"now": False}

        def _stop(signum, _frame):
            stopping["now"] = True
            self._say(f"Scheduler: signal {signum} received, finishing current job then exiting.")

        signal.signal(signal.SIGTERM, _stop)
        signal.signal(signal.SIGINT, _stop)

        self._say(self.style.SUCCESS(
            f"Scheduler started (tick={tick}s, stats at {stats_hour:02d}h local). Jobs: "
            + ", ".join(j.name for j in jobs)
        ))

        while not stopping["now"]:
            now = timezone.localtime()
            for job in jobs:
                if stopping["now"]:
                    break
                if job.is_due(now):
                    self._run(job)
            # Sleep in short slices so SIGTERM is honoured promptly.
            slept = 0
            while slept < tick and not stopping["now"]:
                time.sleep(min(5, tick - slept))
                slept += 5

        self._say(self.style.SUCCESS("Scheduler stopped."))

    def _say(self, message: str) -> None:
        self.stdout.write(message)
        self.stdout.flush()

    def _run(self, job: Job) -> None:
        started = timezone.now()
        self._say(f"Scheduler: running {job.name}...")
        try:
            job.run()
        except Exception as exc:  # never let one job kill the loop
            logger.exception("Scheduled job %s failed: %s", job.name, exc)
            self._say(self.style.ERROR(f"Scheduler: {job.name} failed: {exc}"))
        finally:
            # Mark the attempt either way, so a failing job cannot spin.
            job.last_run = timezone.localtime()
            elapsed = (timezone.now() - started).total_seconds()
            self._say(f"Scheduler: {job.name} finished in {elapsed:.1f}s.")
