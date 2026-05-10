from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_socialnetwork_unique_platform'),
    ]

    operations = [
        migrations.CreateModel(
            name='SupportTicket',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('subject', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('status', models.CharField(choices=[('open', 'Open'), ('in_progress', 'In progress'), ('closed', 'Closed')], default='open', max_length=20)),
                ('priority', models.CharField(choices=[('normal', 'Normal'), ('high', 'High'), ('urgent', 'Urgent')], default='normal', max_length=20)),
                ('admin_note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='support_tickets', to='api.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
