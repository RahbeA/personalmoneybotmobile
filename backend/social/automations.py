"""Resolve audiences and deliver admin-configured notification automations."""

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from courses.models import UserStats

from .models import (
    DeviceToken,
    Notification,
    NotificationAutomation,
    NotificationAutomationDelivery,
    NotificationCampaign,
)
from .push import push_to_user


def automation_audience(automation):
    """Static audience for broadcast_recurring (mirrors campaign_audience)."""
    User = get_user_model()
    users = User.objects.filter(is_active=True)
    if not automation.include_staff:
        users = users.filter(is_staff=False)

    if automation.audience == NotificationCampaign.AUDIENCE_SELECTED:
        users = users.filter(pk__in=automation.recipients.values('pk'))
    elif automation.audience == NotificationCampaign.AUDIENCE_IOS:
        users = users.filter(device_tokens__platform=DeviceToken.PLATFORM_IOS)
    elif automation.audience == NotificationCampaign.AUDIENCE_ANDROID:
        users = users.filter(device_tokens__platform=DeviceToken.PLATFORM_ANDROID)

    return users.distinct().order_by('pk')


def _trigger_audience(automation):
    """Dynamic audience for inactive / streak-at-risk triggers."""
    User = get_user_model()
    today = timezone.localdate()
    config = automation.trigger_config or {}
    users = User.objects.filter(is_active=True)
    if not automation.include_staff:
        users = users.filter(is_staff=False)

    if automation.trigger_type == NotificationAutomation.TRIGGER_INACTIVE:
        days = int(config.get('inactive_days') or 7)
        cutoff = today - timedelta(days=days)
        stats_qs = UserStats.objects.filter(user__in=users).filter(
            Q(last_active__lt=cutoff) | Q(last_active__isnull=True, user__date_joined__date__lt=cutoff)
        )
        return User.objects.filter(pk__in=stats_qs.values('user_id')).distinct()

    if automation.trigger_type == NotificationAutomation.TRIGGER_STREAK:
        min_streak = int(config.get('streak_min') or 1)
        stats_qs = UserStats.objects.filter(
            user__in=users,
            streak_days__gte=min_streak,
        ).filter(Q(last_active__lt=today) | Q(last_active__isnull=True))
        return User.objects.filter(pk__in=stats_qs.values('user_id')).distinct()

    return User.objects.none()


def resolve_automation_users(automation):
    if automation.trigger_type == NotificationAutomation.TRIGGER_BROADCAST:
        return automation_audience(automation)
    return _trigger_audience(automation)


def _cooldown_cutoff(automation):
    days = max(1, automation.cooldown_days or 1)
    return timezone.now() - timedelta(days=days)


def _eligible_user_ids(automation, user_ids):
    """Drop users who received this automation inside the cooldown window."""
    if not user_ids:
        return []
    cutoff = _cooldown_cutoff(automation)
    recently_sent = set(
        NotificationAutomationDelivery.objects.filter(
            automation=automation,
            user_id__in=user_ids,
            sent_at__gte=cutoff,
        ).values_list('user_id', flat=True)
    )
    return [uid for uid in user_ids if uid not in recently_sent]


def preview_automation(automation):
    users = resolve_automation_users(automation)
    user_ids = list(users.values_list('pk', flat=True))
    eligible = _eligible_user_ids(automation, user_ids)
    token_users = (
        DeviceToken.objects.filter(user_id__in=eligible)
        .values('user_id')
        .distinct()
        .count()
        if eligible else 0
    )
    return {
        'audience_count': len(user_ids),
        'eligible_count': len(eligible),
        'users_with_push': token_users,
        'sample': list(users.values('id', 'email', 'name')[:10]),
    }


def _deliver_to_user(automation, user):
    payload = {
        **(automation.data or {}),
        'kind': Notification.TYPE_ANNOUNCEMENT,
        'automation_id': automation.pk,
    }
    notification = Notification.objects.create(
        recipient=user,
        kind=Notification.TYPE_ANNOUNCEMENT,
        title=automation.title,
        body=automation.body,
        data=payload,
    )
    if automation.send_push:
        try:
            push_to_user(user, automation.title, automation.body, data=payload)
        except Exception:
            pass
    NotificationAutomationDelivery.objects.create(automation=automation, user=user)
    return notification


def run_automation(automation, *, force=False):
    """Deliver notifications for one automation. Returns count sent."""
    if not automation.enabled and not force:
        return 0

    now = timezone.now()
    if not force and not _is_due(automation, now):
        return 0

    users = resolve_automation_users(automation)
    user_ids = list(users.values_list('pk', flat=True))
    eligible_ids = _eligible_user_ids(automation, user_ids)
    if not eligible_ids:
        NotificationAutomation.objects.filter(pk=automation.pk).update(
            last_run_at=now,
            last_run_count=0,
            last_error='',
        )
        return 0

    User = get_user_model()
    sent = 0
    error = ''
    try:
        for user in User.objects.filter(pk__in=eligible_ids).iterator():
            _deliver_to_user(automation, user)
            sent += 1
    except Exception as exc:
        error = str(exc)[:2000]

    NotificationAutomation.objects.filter(pk=automation.pk).update(
        last_run_at=now,
        last_run_count=sent,
        last_error=error,
    )
    return sent


def _is_due(automation, now):
    """True when local time is past run_at_time and the recurrence slot hasn't fired today."""
    if automation.last_run_at and automation.last_run_at.date() == now.date():
        return False

    run_time = automation.run_at_time
    if now.time() < run_time:
        return False

    if automation.trigger_type == NotificationAutomation.TRIGGER_BROADCAST:
        if automation.recurrence == NotificationAutomation.RECURRENCE_WEEKLY:
            return now.weekday() == automation.run_weekday
        return True

    # Trigger rules: evaluate once per day at run_at_time.
    return True


def dispatch_due_automations():
    """Run every enabled automation that is due. Returns total notifications sent."""
    total = 0
    for automation in NotificationAutomation.objects.filter(enabled=True):
        total += run_automation(automation)
    return total


def dispatch_scheduled_campaigns():
    """Send notification campaigns whose scheduled_at has passed."""
    from .campaigns import send_campaign
    from .models import NotificationCampaign

    now = timezone.now()
    due = NotificationCampaign.objects.filter(
        status=NotificationCampaign.STATUS_SCHEDULED,
        scheduled_at__lte=now,
    )
    sent = 0
    for campaign in due:
        try:
            send_campaign(campaign)
            sent += 1
        except Exception:
            pass
    return sent
