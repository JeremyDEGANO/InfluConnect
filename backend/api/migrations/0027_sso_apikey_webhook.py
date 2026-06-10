from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_socialnetwork_avatar_url_socialnetwork_bio_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BrandDomain',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('domain', models.CharField(db_index=True, max_length=253)),
                ('verification_token', models.CharField(max_length=64)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('verified', 'Verified'), ('failed', 'Failed'), ('expired', 'Expired')], default='pending', max_length=12)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('last_checked_at', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('brand', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='domains', to='api.brandprofile')),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='branddomain',
            constraint=models.UniqueConstraint(fields=('brand', 'domain'), name='uniq_brand_domain'),
        ),
        migrations.CreateModel(
            name='BrandSSOConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('provider', models.CharField(choices=[('office365', 'Office 365 / Entra ID')], default='office365', max_length=20)),
                ('enabled', models.BooleanField(default=False)),
                ('tenant_id', models.CharField(blank=True, max_length=64)),
                ('client_id', models.CharField(blank=True, max_length=64)),
                ('client_secret_enc', models.TextField(blank=True)),
                ('enforce_sso', models.BooleanField(default=False)),
                ('allow_local_fallback_for_owner', models.BooleanField(default=True)),
                ('auto_provision_users', models.BooleanField(default=False)),
                ('default_role', models.CharField(default='member', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('brand', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='sso_config', to='api.brandprofile')),
            ],
        ),
        migrations.CreateModel(
            name='ApiKey',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=120)),
                ('prefix', models.CharField(db_index=True, max_length=24, unique=True)),
                ('hashed_secret', models.CharField(max_length=128)),
                ('scopes', models.JSONField(blank=True, default=list)),
                ('ip_allowlist', models.JSONField(blank=True, default=list)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('last_used_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('brand', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='api_keys', to='api.brandprofile')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='ApiAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('method', models.CharField(max_length=8)),
                ('path', models.CharField(max_length=255)),
                ('status_code', models.PositiveSmallIntegerField()),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('latency_ms', models.PositiveIntegerField(default=0)),
                ('request_id', models.CharField(blank=True, max_length=36)),
                ('error', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('api_key', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_entries', to='api.apikey')),
                ('brand', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='api_audit_entries', to='api.brandprofile')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['brand', '-created_at'], name='api_apiaudi_brand_i_idx'),
                    models.Index(fields=['api_key', '-created_at'], name='api_apiaudi_apikey_i_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='WebhookEndpoint',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('url', models.URLField(max_length=600)),
                ('secret', models.CharField(max_length=64)),
                ('events', models.JSONField(blank=True, default=list)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('enabled', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('last_delivery_at', models.DateTimeField(blank=True, null=True)),
                ('last_status', models.CharField(blank=True, max_length=16)),
                ('brand', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='webhook_endpoints', to='api.brandprofile')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='WebhookDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('event', models.CharField(max_length=64)),
                ('payload', models.JSONField(default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed'), ('retry', 'Retry')], default='pending', max_length=12)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('next_retry_at', models.DateTimeField(blank=True, null=True)),
                ('response_status', models.PositiveSmallIntegerField(blank=True, null=True)),
                ('response_body', models.TextField(blank=True)),
                ('error', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('endpoint', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='api.webhookendpoint')),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [models.Index(fields=['endpoint', '-created_at'], name='api_webhook_endpoin_i_idx')],
            },
        ),
    ]
