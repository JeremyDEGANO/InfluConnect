"""Move existing accounts to French.

`language_preference` defaulted to 'en' and registration never set it, so every
account created so far is flagged English and received English transactional
emails (approval, rejection, invitations...) on a French-first platform.

Nobody could have chosen 'en' deliberately either: the registration API had no
language field at all until now, and the profile screen does not expose one. So
every stored 'en' is the unintended default rather than a user choice, and is
safe to flip. Users who genuinely want English can be switched from the admin.
"""
from django.db import migrations


def set_french(apps, schema_editor):
    User = apps.get_model("api", "User")
    User.objects.filter(language_preference="en").update(language_preference="fr")


def noop(apps, schema_editor):
    # Deliberately not reversible: we cannot tell which rows were 'en' before.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0043_brandprofile_billing_city_and_more"),
    ]

    operations = [
        migrations.RunPython(set_french, noop),
    ]
