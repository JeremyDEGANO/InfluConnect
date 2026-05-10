from django.db import migrations, models


def dedupe_social_networks(apps, schema_editor):
    SocialNetwork = apps.get_model('api', 'SocialNetwork')
    by_profile_platform = {}

    for row in SocialNetwork.objects.order_by('influencer_id', 'platform', 'id').values('id', 'influencer_id', 'platform'):
        key = (row['influencer_id'], row['platform'])
        by_profile_platform.setdefault(key, []).append(row['id'])

    for ids in by_profile_platform.values():
        if len(ids) <= 1:
            continue
        keep_id = ids[-1]
        SocialNetwork.objects.filter(id__in=ids[:-1]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_brandprofile_agency_default_commission_percent_and_more'),
    ]

    operations = [
        migrations.RunPython(dedupe_social_networks, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='socialnetwork',
            constraint=models.UniqueConstraint(
                fields=('influencer', 'platform'),
                name='uniq_social_network_per_platform',
            ),
        ),
    ]
