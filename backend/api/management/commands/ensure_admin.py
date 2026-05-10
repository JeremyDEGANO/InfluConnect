import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Ensure an admin user exists and has staff/superuser privileges."

    def handle(self, *args, **options):
        User = get_user_model()

        username = os.getenv("ADMIN_USERNAME", "admin").strip() or "admin"
        email = os.getenv("ADMIN_EMAIL", "admin@local.dev").strip() or "admin@local.dev"
        password = os.getenv("ADMIN_PASSWORD", "AdminLocal123!")

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "user_type": "admin",
                "is_staff": True,
                "is_superuser": True,
            },
        )

        changed = False

        if created:
            user.set_password(password)
            changed = True
        else:
            if not user.email:
                user.email = email
                changed = True

        if user.user_type != "admin":
            user.user_type = "admin"
            changed = True
        if not user.is_staff:
            user.is_staff = True
            changed = True
        if not user.is_superuser:
            user.is_superuser = True
            changed = True

        if changed:
            user.save()

        action = "created" if created else "checked"
        self.stdout.write(self.style.SUCCESS(f"Admin {action}: username={username}, email={user.email}"))
