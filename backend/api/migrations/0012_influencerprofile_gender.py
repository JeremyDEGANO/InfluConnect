from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_influencerprofile_collaboration_pitch'),
    ]

    operations = [
        migrations.AddField(
            model_name='influencerprofile',
            name='gender',
            field=models.CharField(
                blank=True,
                max_length=20,
                choices=[
                    ('she', 'Elle'),
                    ('he', 'Il'),
                    ('they', 'Iel'),
                    ('other', 'Autre'),
                    ('prefer_not', 'Préfère ne pas dire'),
                ],
            ),
        ),
    ]
