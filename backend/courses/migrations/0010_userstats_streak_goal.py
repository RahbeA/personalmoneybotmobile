from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0009_onboardingquestion_input_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='userstats',
            name='streak_goal',
            field=models.PositiveIntegerField(
                default=7,
                help_text='Personal streak commitment in days (e.g. 7, 14, 30, 60).',
            ),
        ),
    ]
