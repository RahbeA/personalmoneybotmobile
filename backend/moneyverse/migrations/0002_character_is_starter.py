from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('moneyverse', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='character',
            name='is_starter',
            field=models.BooleanField(
                default=False,
                help_text='Gifted and equipped automatically when a new account is created. Only one character can be the starter.',
            ),
        ),
    ]
