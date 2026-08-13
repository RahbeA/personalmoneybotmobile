import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def backfill_claims(apps, schema_editor):
    """Convert legacy single-use redemptions into InviteClaim attribution rows."""
    Invite = apps.get_model('accounts', 'Invite')
    InviteClaim = apps.get_model('accounts', 'InviteClaim')

    for invite in Invite.objects.filter(used_by__isnull=False).iterator():
        if InviteClaim.objects.filter(user_id=invite.used_by_id).exists():
            continue
        claim = InviteClaim.objects.create(
            invite=invite,
            user_id=invite.used_by_id,
            # Already-joined users predate the reward, so mark them credited to
            # avoid retroactively minting Bot Bucks.
            rewarded=True,
        )
        joined_at = invite.used_at or invite.created_at or timezone.now()
        InviteClaim.objects.filter(pk=claim.pk).update(created_at=joined_at)
        Invite.objects.filter(pk=invite.pk).update(uses_count=1)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_invite_and_inviteconfig'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='invite',
            name='max_uses',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='invite',
            name='uses_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='InviteClaim',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rewarded', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('invite', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='claims', to='accounts.invite')),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='invite_claim', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at', 'id'],
            },
        ),
        migrations.RunPython(backfill_claims, noop_reverse),
    ]
