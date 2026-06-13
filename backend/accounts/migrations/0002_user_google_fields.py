from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='user',
            name='avatar_url',
            field=models.URLField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='user',
            name='google_id',
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
