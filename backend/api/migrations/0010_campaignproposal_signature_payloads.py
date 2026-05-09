from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0009_campaignproposal_contract_template"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaignproposal",
            name="brand_signature_data",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="campaignproposal",
            name="brand_signature_mode",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="campaignproposal",
            name="brand_signature_value",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="campaignproposal",
            name="influencer_signature_data",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="campaignproposal",
            name="influencer_signature_mode",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="campaignproposal",
            name="influencer_signature_value",
            field=models.TextField(blank=True),
        ),
    ]