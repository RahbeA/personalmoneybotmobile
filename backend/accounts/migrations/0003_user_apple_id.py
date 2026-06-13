from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_google_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='apple_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
