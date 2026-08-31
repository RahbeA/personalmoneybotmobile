from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0012_seed_money_tips'),
        ('moneyverse', '0003_sprint_mobile_shared_models'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='userstats',
            name='equipped_hat',
        ),
        migrations.AlterField(
            model_name='badge',
            name='metric',
            field=models.CharField(
                choices=[
                    ('lessons_completed', 'Lessons completed'),
                    ('modules_completed', 'Modules completed (all lessons in module)'),
                    ('module_completed', 'Specific module completed'),
                    ('streak_days', 'Lesson activity streak (days)'),
                    ('daily_claim_streak', 'Daily reward claim streak (days)'),
                    ('daily_reward_day', 'Daily reward tier reached (1–7)'),
                    ('bot_bucks', 'Bot Bucks balance'),
                    ('xp', 'Total XP'),
                    ('onboarding_score', 'Onboarding score'),
                    ('characters_owned', 'Characters owned'),
                    ('friends_count', 'Accepted friends'),
                    ('questions_correct', 'Questions answered correctly'),
                    ('perfect_lessons', 'Perfect lessons (0 mistakes)'),
                ],
                max_length=30,
            ),
        ),
    ]
