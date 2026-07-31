"""Audience resolution and idempotent delivery for admin notification campaigns."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from .models import DeviceToken, Notification, NotificationCampaign
from .push import send_expo_push


def campaign_audience(campaign):
    """Return the distinct active users targeted by a campaign."""
    User = get_user_model()
    users = User.objects.filter(is_active=True)
    if not campaign.include_staff:
        users = users.filter(is_staff=False)

    if campaign.audience == NotificationCampaign.AUDIENCE_SELECTED:
        users = users.filter(pk__in=campaign.recipients.values('pk'))
    elif campaign.audience == NotificationCampaign.AUDIENCE_IOS:
        users = users.filter(device_tokens__platform=DeviceToken.PLATFORM_IOS)
    elif campaign.audience == NotificationCampaign.AUDIENCE_ANDROID:
        users = users.filter(device_tokens__platform=DeviceToken.PLATFORM_ANDROID)

    return users.distinct().order_by('pk')


def audience_push_stats(campaign):
    """Return audience size + how many of those users have a registered push token."""
    audience = campaign_audience(campaign)
    recipient_ids = list(audience.values_list('pk', flat=True))
    token_users = (
        DeviceToken.objects.filter(user_id__in=recipient_ids)
        .values('user_id')
        .distinct()
        .count()
        if recipient_ids else 0
    )
    token_count = (
        DeviceToken.objects.filter(user_id__in=recipient_ids).count()
        if recipient_ids else 0
    )
    return {
        'count': len(recipient_ids),
        'users_with_push': token_users,
        'device_tokens': token_count,
        'sample': list(
            audience.values('id', 'email', 'name')[:10]
        ),
    }


def send_campaign(campaign):
    """Persist the in-app feed and send push once for a campaign.

    The status transition is protected by a row lock, and each campaign/user
    pair has a database uniqueness constraint. Together those prevent double
    delivery if an admin refreshes or submits twice.
    """
    with transaction.atomic():
        locked = NotificationCampaign.objects.select_for_update().get(pk=campaign.pk)
        if locked.status == NotificationCampaign.STATUS_SENT:
            return locked
        if locked.status == NotificationCampaign.STATUS_SENDING:
            raise ValueError('This campaign is already being sent.')
        if locked.status not in (
            NotificationCampaign.STATUS_DRAFT,
            NotificationCampaign.STATUS_FAILED,
        ):
            raise ValueError('This campaign cannot be sent from its current state.')

        recipient_ids = list(campaign_audience(locked).values_list('pk', flat=True))
        if not recipient_ids:
            raise ValueError('The selected audience contains no active users.')

        locked.status = NotificationCampaign.STATUS_SENDING
        locked.error_message = ''
        locked.target_count = len(recipient_ids)
        locked.save(update_fields=['status', 'error_message', 'target_count'])

        Notification.objects.bulk_create(
            [
                Notification(
                    recipient_id=user_id,
                    kind=Notification.TYPE_ANNOUNCEMENT,
                    title=locked.title,
                    body=locked.body,
                    data={
                        **(locked.data or {}),
                        'kind': Notification.TYPE_ANNOUNCEMENT,
                        'campaign_id': locked.pk,
                    },
                    campaign=locked,
                )
                for user_id in recipient_ids
            ],
            ignore_conflicts=True,
        )

    push_count = 0
    try:
        if locked.send_push:
            tokens = list(
                DeviceToken.objects.filter(user_id__in=recipient_ids)
                .values_list('token', flat=True)
                .distinct()
            )
            if not tokens:
                raise RuntimeError(
                    f'In-app notifications were created for {len(recipient_ids)} user(s), '
                    'but none of them have a registered Expo push token. '
                    'Ask users to open MoneyBot on a physical device and allow notifications, '
                    'then try again (or turn off “Also send OS push”).'
                )
            result = send_expo_push(
                tokens,
                locked.title,
                locked.body,
                data={
                    **(locked.data or {}),
                    'kind': Notification.TYPE_ANNOUNCEMENT,
                    'campaign_id': locked.pk,
                },
                raise_on_failure=True,
            )
            push_count = result.accepted
    except Exception as exc:
        NotificationCampaign.objects.filter(pk=locked.pk).update(
            status=NotificationCampaign.STATUS_FAILED,
            error_message=str(exc)[:2000],
            push_count=push_count,
        )
        raise

    NotificationCampaign.objects.filter(pk=locked.pk).update(
        status=NotificationCampaign.STATUS_SENT,
        sent_at=timezone.now(),
        push_count=push_count,
        error_message='',
    )
    locked.refresh_from_db()
    return locked
