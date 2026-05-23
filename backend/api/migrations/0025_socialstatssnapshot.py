from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0024_eventinvitation_external_email_and_checkin'),
    ]

    operations = [
        migrations.CreateModel(
            name='SocialStatsSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_date', models.DateField()),
                ('followers_count', models.IntegerField(default=0)),
                ('avg_views', models.IntegerField(default=0)),
                ('engagement_rate', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('raw_response', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('social_network', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='stats_snapshots',
                    to='api.socialnetwork',
                )),
            ],
            options={'ordering': ['-snapshot_date']},
        ),
        migrations.AddConstraint(
            model_name='socialstatssnapshot',
            constraint=models.UniqueConstraint(
                fields=('social_network', 'snapshot_date'),
                name='uniq_social_snapshot_per_day',
            ),
        ),
    ]
