"""Grandfather existing accounts through email verification.

Email verification is new. Accounts that predate it were never asked to confirm
their address, so flagging them all unverified would retroactively gate people
who are already using the platform — including brands our team has manually
approved, which is a stronger ownership signal than a click on a link.

Existing users are therefore marked verified; verification applies to accounts
created from here on.
"""
from django.db import migrations
from django.utils import timezone


def verify_existing(apps, schema_editor):
    User = apps.get_model("api", "User")
    User.objects.filter(email_verified=False).update(
        email_verified=True, email_verified_at=timezone.now(),
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0045_user_email_verified_user_email_verified_at"),
    ]

    operations = [
        migrations.RunPython(verify_existing, noop),
    ]
