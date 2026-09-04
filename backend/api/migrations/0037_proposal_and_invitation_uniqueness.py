from django.db import migrations, models
from django.db.models.functions import Lower


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0036_user_auth_version"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="teaminvitation",
            name="uniq_pending_team_invitation_per_email",
        ),
        migrations.AddConstraint(
            model_name="teaminvitation",
            constraint=models.UniqueConstraint(
                Lower("invited_email"), models.F("organization"),
                condition=models.Q(status="pending"),
                name="uniq_pending_team_invitation_per_email",
            ),
        ),
        migrations.AddConstraint(
            model_name="campaignproposal",
            constraint=models.UniqueConstraint(
                fields=("campaign", "influencer"),
                name="uniq_campaign_proposal_per_influencer",
            ),
        ),
    ]