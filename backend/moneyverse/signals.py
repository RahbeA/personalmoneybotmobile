from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from moneybot.cache_utils import invalidate_leaderboard_snapshots

from .models import Character


@receiver(post_save, sender=Character)
@receiver(post_delete, sender=Character)
def bust_character_catalog(sender, **kwargs):
    from django.core.cache import cache
    cache.delete('moneyverse:catalog:v1')
    cache.delete('moneyverse:catalog:v2')
    invalidate_leaderboard_snapshots()
