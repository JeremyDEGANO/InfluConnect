from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0035_review_uniqueness"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="auth_version",
            field=models.PositiveIntegerField(default=0),
        ),
    ]