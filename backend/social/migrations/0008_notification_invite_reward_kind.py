from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('social', '0007_friend_nudge_and_notification_kind'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='kind',
            field=models.CharField(
                choices=[
                    ('friend_request', 'Friend request received'),
                    ('friend_accepted', 'Friend request accepted'),
                    ('friend_declined', 'Friend request declined'),
                    ('friend_nudge', 'Friend nudge'),
                    ('invite_reward', 'Invite reward earned'),
                    ('announcement', 'Admin announcement'),
                ],
                max_length=32,
            ),
        ),
    ]
