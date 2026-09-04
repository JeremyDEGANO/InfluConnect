import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


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

        if not created and not (user.user_type == "admin" and user.is_staff and user.is_superuser):
            raise CommandError(
                f"Refusing to promote existing non-admin username '{username}'. "
                "Choose a unique ADMIN_USERNAME or remove the conflicting account explicitly."
            )

        changed = False

        if created:
            try:
                validate_password(password, user=user)
            except ValidationError as exc:
                user.delete()
                raise CommandError(f"Invalid ADMIN_PASSWORD: {'; '.join(exc.messages)}") from exc
            user.set_password(password)
            changed = True
        else:
            if not user.email:
                user.email = email
                changed = True

        if changed:
            user.save()

        action = "created" if created else "checked"
        self.stdout.write(self.style.SUCCESS(f"Admin {action}: username={username}, email={user.email}"))
