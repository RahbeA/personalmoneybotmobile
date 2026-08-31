from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0009_sprint_mobile_shared_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='notificationcampaign',
            name='scheduled_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When set, the campaign sends automatically at or after this time.',
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name='notificationcampaign',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('scheduled', 'Scheduled'),
                    ('sending', 'Sending'),
                    ('sent', 'Sent'),
                    ('failed', 'Failed'),
                ],
                default='draft',
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name='NotificationAutomation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('enabled', models.BooleanField(default=True)),
                ('trigger_type', models.CharField(
                    choices=[
                        ('broadcast_recurring', 'Recurring broadcast'),
                        ('inactive_users', 'Inactive users'),
                        ('streak_at_risk', 'Streak at risk'),
                    ],
                    max_length=32,
                )),
                ('trigger_config', models.JSONField(blank=True, default=dict)),
                ('title', models.CharField(max_length=140)),
                ('body', models.CharField(max_length=280)),
                ('audience', models.CharField(
                    choices=[
                        ('all', 'All active users'),
                        ('selected', 'Selected users'),
                        ('ios', 'Active users with an iOS device'),
                        ('android', 'Active users with an Android device'),
                    ],
                    default='all',
                    max_length=16,
                )),
                ('include_staff', models.BooleanField(default=False)),
                ('send_push', models.BooleanField(default=True)),
                ('data', models.JSONField(blank=True, default=dict)),
                ('recurrence', models.CharField(
                    choices=[('daily', 'Daily'), ('weekly', 'Weekly')],
                    default='daily',
                    help_text='Used for broadcast_recurring; trigger rules run once per day.',
                    max_length=16,
                )),
                ('run_at_time', models.TimeField(default='18:00', help_text='UTC time of day when this automation may run.')),
                ('run_weekday', models.PositiveSmallIntegerField(default=0, help_text='0=Monday … 6=Sunday; used when recurrence is weekly.')),
                ('cooldown_days', models.PositiveIntegerField(default=7, help_text='Minimum days before the same user can receive this automation again.')),
                ('last_run_at', models.DateTimeField(blank=True, null=True)),
                ('last_run_count', models.PositiveIntegerField(default=0)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('recipients', models.ManyToManyField(
                    blank=True,
                    related_name='notification_automations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-updated_at']},
        ),
        migrations.CreateModel(
            name='NotificationAutomationDelivery',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('automation', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deliveries', to='social.notificationautomation')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='automation_deliveries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'indexes': [models.Index(fields=['automation', 'user', '-sent_at'], name='social_noti_automat_6e8f0d_idx')],
            },
        ),
    ]
