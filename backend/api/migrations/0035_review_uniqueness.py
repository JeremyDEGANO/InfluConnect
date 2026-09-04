from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0034_platform_feature_toggles"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="review",
            constraint=models.UniqueConstraint(
                fields=("proposal", "reviewer"),
                name="uniq_review_per_proposal_reviewer",
            ),
        ),
    ]