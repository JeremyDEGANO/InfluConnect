from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_campaignproposal_signature_payloads'),
    ]

    operations = [
        migrations.AddField(
            model_name='influencerprofile',
            name='collaboration_pitch',
            field=models.TextField(blank=True),
        ),
    ]
