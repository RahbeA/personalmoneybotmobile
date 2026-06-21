# Generated manually for badges + daily rewards

from django.db import migrations, models
import django.db.models.deletion


DEFAULT_DAILY_TIERS = [5, 10, 15, 20, 30, 40, 75]

SEED_BADGES = [
    ('first_lesson', 'First Step', 'Complete your first lesson.', 'lessons_completed', 1, None, '#3DDC5F', 'flag', 0),
    ('streak_7', '7-Day Streak', 'Maintain a 7-day lesson streak.', 'streak_days', 7, None, '#FF6B35', 'flame', 10),
    ('streak_30', '30-Day Streak', 'Maintain a 30-day lesson streak.', 'streak_days', 30, None, '#F39C12', 'flash', 11),
    ('all_courses', 'Graduate', 'Complete every lesson in the app.', 'lessons_completed', 9999, None, '#3DDC5F', 'school', 20),
]


def seed_badges_and_tiers(apps, schema_editor):
    Badge = apps.get_model('courses', 'Badge')
    DailyRewardTier = apps.get_model('courses', 'DailyRewardTier')
    Module = apps.get_model('courses', 'Module')

    for day, bucks in enumerate(DEFAULT_DAILY_TIERS, start=1):
        DailyRewardTier.objects.update_or_create(day=day, defaults={'bot_bucks': bucks})

    module_badges = [
        (1, 'module_1', 'Budget Master', 'wallet', '#FFD700'),
        (2, 'module_2', 'Savings Pro', 'trending-up', '#00CED1'),
        (3, 'module_3', 'Credit Wise', 'card', '#9B59B6'),
        (4, 'module_4', 'Tax Savvy', 'receipt', '#E67E22'),
        (5, 'module_5', 'Insurance Expert', 'shield-checkmark', '#E74C3C'),
    ]
    for order, key, name, ion, color in module_badges:
        mod = Module.objects.filter(order=order).first()
        Badge.objects.update_or_create(
            key=key,
            defaults={
                'name': name,
                'description': f'Complete all lessons in {name.split()[0] if name else "module"}.',
                'metric': 'module_completed',
                'threshold': 1,
                'module_id': mod.id if mod else None,
                'accent_color': color,
                'ion_icon': ion,
                'order': order,
                'is_active': True,
            },
        )

    for key, name, desc, metric, threshold, _mod, color, ion, order in SEED_BADGES:
        if key == 'all_courses':
            threshold = apps.get_model('courses', 'Lesson').objects.count() or 1
        Badge.objects.update_or_create(
            key=key,
            defaults={
                'name': name,
                'description': desc,
                'metric': metric,
                'threshold': threshold,
                'accent_color': color,
                'ion_icon': ion,
                'order': order,
                'is_active': True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0007_add_match_fill_blank_types'),
    ]

    operations = [
        migrations.AddField(
            model_name='userstats',
            name='daily_claim_streak',
            field=models.PositiveIntegerField(default=0, help_text='Consecutive days the daily reward was claimed.'),
        ),
        migrations.AddField(
            model_name='userstats',
            name='daily_reward_day',
            field=models.PositiveIntegerField(default=1, help_text='Next reward tier (1–7) on claim.'),
        ),
        migrations.AddField(
            model_name='userstats',
            name='last_daily_claim',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userstats',
            name='perfect_lessons',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userstats',
            name='questions_answered',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userstats',
            name='questions_correct',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='Badge',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(max_length=50, unique=True)),
                ('name', models.CharField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('metric', models.CharField(choices=[('lessons_completed', 'Lessons completed'), ('modules_completed', 'Modules completed (all lessons in module)'), ('module_completed', 'Specific module completed'), ('streak_days', 'Lesson activity streak (days)'), ('daily_claim_streak', 'Daily reward claim streak (days)'), ('daily_reward_day', 'Daily reward tier reached (1–7)'), ('bot_bucks', 'Bot Bucks balance'), ('xp', 'Total XP'), ('onboarding_score', 'Onboarding score'), ('characters_owned', 'Characters owned'), ('questions_correct', 'Questions answered correctly'), ('perfect_lessons', 'Perfect lessons (0 mistakes)')], max_length=30)),
                ('threshold', models.PositiveIntegerField(default=1)),
                ('icon', models.ImageField(blank=True, null=True, upload_to='badges/')),
                ('accent_color', models.CharField(default='#3DDC5F', max_length=7)),
                ('ion_icon', models.CharField(default='ribbon', help_text='Ionicons fallback when no icon image is uploaded.', max_length=40)),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('module', models.ForeignKey(blank=True, help_text='Required for module_completed metric.', null=True, on_delete=django.db.models.deletion.CASCADE, to='courses.module')),
            ],
            options={
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='DailyRewardTier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('day', models.PositiveIntegerField(unique=True)),
                ('bot_bucks', models.PositiveIntegerField()),
            ],
            options={
                'ordering': ['day'],
            },
        ),
        migrations.RunPython(seed_badges_and_tiers, migrations.RunPython.noop),
    ]
