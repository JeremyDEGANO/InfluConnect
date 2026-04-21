from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_campaign_description_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaign',
            name='max_influencers',
            field=models.PositiveIntegerField(default=1),
        ),
    ]
