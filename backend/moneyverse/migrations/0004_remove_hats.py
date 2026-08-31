from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('moneyverse', '0003_sprint_mobile_shared_models'),
        ('courses', '0013_remove_hats'),
    ]

    operations = [
        migrations.DeleteModel(
            name='UserHat',
        ),
        migrations.DeleteModel(
            name='Hat',
        ),
    ]
