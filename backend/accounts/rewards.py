"""Referral rewards: credit the inviter when someone they invited joins."""

import logging

from django.conf import settings
from django.db import transaction

logger = logging.getLogger(__name__)


def _display_name(user):
    name = (getattr(user, 'name', '') or '').strip()
    if name:
        return name
    email = getattr(user, 'email', None)
    if email:
        return email.split('@')[0]
    return 'A friend'


def reward_inviter_for_signup(invite, invitee):
    """Grant the inviter Bot Bucks when `invitee` joins via their code.

    Idempotent: the reward is gated on the InviteClaim.rewarded flag, so replays
    or double calls never double-credit. Seed/admin codes (no creator) and
    self-invites are skipped. Best-effort; never raises into the signup flow.
    """
    if invite is None or invitee is None:
        return None

    inviter_id = getattr(invite, 'created_by_id', None)
    if not inviter_id or inviter_id == getattr(invitee, 'id', None):
        return None

    amount = int(getattr(settings, 'INVITE_REWARD_BOT_BUCKS', 50) or 0)
    if amount <= 0:
        return None

    from .models import InviteClaim

    try:
        with transaction.atomic():
            claim = (
                InviteClaim.objects.select_for_update()
                .filter(invite=invite, user=invitee)
                .first()
            )
            if claim is None or claim.rewarded:
                return None

            inviter = invite.created_by
            if inviter is None or getattr(inviter, 'is_guest', False):
                return None

            from courses.views import get_or_create_stats

            stats = get_or_create_stats(inviter)
            stats.bot_bucks = int(stats.bot_bucks or 0) + amount
            stats.save(update_fields=['bot_bucks'])

            claim.rewarded = True
            claim.save(update_fields=['rewarded'])
    except Exception:
        logger.exception('Failed to reward inviter %s for signup', inviter_id)
        return None

    # Side effects below are best-effort and must not undo the credited reward.
    try:
        from moneybot.cache_utils import invalidate_user_cache

        invalidate_user_cache(inviter.id)
    except Exception:
        pass

    try:
        from courses.badges import evaluate_and_award
        from courses.views import get_or_create_stats

        evaluate_and_award(inviter, get_or_create_stats(inviter))
    except Exception:
        pass

    try:
        from social.models import Notification
        from social.service import create_notification

        create_notification(
            recipient=inviter,
            kind=Notification.TYPE_INVITE_REWARD,
            title=f'You earned {amount} Bot Bucks!',
            body=f'{_display_name(invitee)} joined MoneyBot with your invite code.',
            actor=invitee,
            data={'bot_bucks': amount},
        )
    except Exception:
        pass

    return amount
