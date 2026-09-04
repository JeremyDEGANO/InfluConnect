from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0037_proposal_and_invitation_uniqueness"),
    ]

    operations = [
        migrations.AddField(
            model_name="brandmembership",
            name="provisioned_by_sso",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="organizationmembership",
            name="provisioned_by_sso",
            field=models.BooleanField(default=False),
        ),
    ]