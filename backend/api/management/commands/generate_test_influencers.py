from __future__ import annotations

import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import InfluencerProfile, SocialNetwork


THEMES = [
    "Beauty", "Fashion", "Tech", "Food", "Travel",
    "Fitness", "Gaming", "Lifestyle", "Finance", "Education",
]

CONTENT_TYPES = ["post", "story", "reel", "video", "short"]

PLATFORMS = [
    "instagram",
    "tiktok",
    "youtube",
    "twitter",
    "twitch",
    "linkedin",
    "snapchat",
    "pinterest",
]

CITIES = [
    "Paris", "Lyon", "Marseille", "Lille", "Bordeaux",
    "Nantes", "Toulouse", "Nice", "Montpellier", "Strasbourg",
]

FIRST_NAMES = [
    "Lea", "Lucas", "Ines", "Nora", "Jade", "Sami", "Amine", "Noah", "Lina", "Adam",
    "Mia", "Eden", "Yanis", "Sarah", "Chloe", "Tom", "Emma", "Ilyes", "Nina", "Mathis",
]

LAST_NAMES = [
    "Martin", "Bernard", "Dubois", "Thomas", "Robert", "Petit", "Durand", "Leroy", "Moreau", "Simon",
    "Laurent", "Lefebvre", "Garcia", "David", "Roux", "Vincent", "Fournier", "Morel", "Girard", "Andre",
]


class Command(BaseCommand):
    help = "Generate test influencer users/profiles/social accounts for marketplace demos."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=30, help="Number of influencers to generate")
        parser.add_argument("--prefix", type=str, default="testinf", help="Username/email prefix")
        parser.add_argument(
            "--password",
            type=str,
            default="TestInfluencer123!",
            help="Password applied to all generated users",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        User = get_user_model()
        count = max(1, int(options["count"]))
        prefix = (options["prefix"] or "testinf").strip().lower()
        password = options["password"]

        created = 0
        existing = 0

        for i in range(1, count + 1):
            suffix = f"{i:03d}"
            username = f"{prefix}_{suffix}"
            email = f"{prefix}.{suffix}@local.dev"

            user, user_created = User.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "user_type": "influencer",
                    "first_name": random.choice(FIRST_NAMES),
                    "last_name": random.choice(LAST_NAMES),
                    "location": random.choice(CITIES),
                    "is_active": True,
                },
            )

            if user_created:
                user.set_password(password)
                user.save(update_fields=["password"])
                created += 1
            else:
                existing += 1

            profile, _ = InfluencerProfile.objects.get_or_create(
                user=user,
                defaults={
                    "display_name": f"{user.first_name} {user.last_name}".strip() or username,
                    "bio": "Creator test profile for marketplace QA.",
                    "gender": random.choice(["she", "he", "they", "prefer_not"]),
                    "languages": [random.choice(["fr", "en"]), "en"],
                    "content_themes": random.sample(THEMES, k=random.randint(1, 3)),
                    "content_types_offered": random.sample(CONTENT_TYPES, k=random.randint(1, 3)),
                    "pricing": {
                        "post": random.randint(80, 1200),
                        "story": random.randint(50, 600),
                        "reel": random.randint(120, 2000),
                    },
                    "is_verified": random.choice([True, False]),
                    "average_rating": round(random.uniform(3.4, 5.0), 2),
                    "onboarding_completed": True,
                    "profile_completion_percent": random.randint(75, 100),
                },
            )

            if not SocialNetwork.objects.filter(influencer=profile).exists():
                for platform in random.sample(PLATFORMS, k=random.randint(1, 3)):
                    SocialNetwork.objects.create(
                        influencer=profile,
                        platform=platform,
                        profile_url=f"https://{platform}.com/{username}",
                        followers_count=random.randint(1_000, 2_500_000),
                        avg_views=random.randint(300, 350_000),
                        engagement_rate=round(random.uniform(0.8, 12.5), 2),
                    )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Requested={count}, users_created={created}, already_existing={existing}, prefix={prefix}"
            )
        )