# Generated manually for social features

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Group',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=80)),
                ('emoji', models.CharField(default='people', max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='owned_groups', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Friendship',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined')], default='pending', max_length=16)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('responded_at', models.DateTimeField(blank=True, null=True)),
                ('addressee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='friendships_received', to=settings.AUTH_USER_MODEL)),
                ('requester', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='friendships_sent', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='GroupChallenge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=120)),
                ('metric', models.CharField(choices=[('xp', 'XP earned'), ('lessons_completed', 'Lessons completed'), ('daily_points', 'Daily challenge points'), ('streak_days', 'Streak days')], max_length=32)),
                ('target', models.PositiveIntegerField()),
                ('starts_at', models.DateTimeField()),
                ('ends_at', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_challenges', to=settings.AUTH_USER_MODEL)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='challenges', to='social.group')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='GroupMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('owner', 'Owner'), ('member', 'Member')], default='member', max_length=16)),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='social.group')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_memberships', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='ChallengeParticipant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('baseline_value', models.PositiveIntegerField(default=0)),
                ('challenge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='participants', to='social.groupchallenge')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='challenge_participations', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name='friendship',
            constraint=models.UniqueConstraint(fields=('requester', 'addressee'), name='unique_friendship_pair'),
        ),
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(fields=['requester', 'status'], name='social_frie_request_8a1f0d_idx'),
        ),
        migrations.AddIndex(
            model_name='friendship',
            index=models.Index(fields=['addressee', 'status'], name='social_frie_addressee_4c8b2a_idx'),
        ),
        migrations.AddIndex(
            model_name='groupchallenge',
            index=models.Index(fields=['group', '-ends_at'], name='social_grou_group_i_7f3e1b_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='groupmembership',
            unique_together={('group', 'user')},
        ),
        migrations.AddIndex(
            model_name='groupmembership',
            index=models.Index(fields=['user'], name='social_grou_user_id_2a9c4d_idx'),
        ),
        migrations.AddIndex(
            model_name='groupmembership',
            index=models.Index(fields=['group'], name='social_grou_group_i_1b5e6f_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='challengeparticipant',
            unique_together={('challenge', 'user')},
        ),
        migrations.AddIndex(
            model_name='challengeparticipant',
            index=models.Index(fields=['challenge'], name='social_chal_challen_3d7a8c_idx'),
        ),
    ]
