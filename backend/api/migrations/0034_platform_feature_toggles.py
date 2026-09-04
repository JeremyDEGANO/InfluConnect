from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0033_brandprofile_subscription_price_override_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="platformsettings",
            name="ambassador_programs_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="events_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="platformsettings",
            name="referral_program_enabled",
            field=models.BooleanField(default=True),
        ),
    ]