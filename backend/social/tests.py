from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from .campaigns import campaign_audience, send_campaign
from .models import DeviceToken, Notification, NotificationCampaign


class NotificationCampaignTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user(email='a@example.com', password='test')
        self.user_b = User.objects.create_user(email='b@example.com', password='test')
        self.staff = User.objects.create_user(
            email='staff@example.com',
            password='test',
            is_staff=True,
        )

    def test_all_active_users_excludes_staff_by_default(self):
        campaign = NotificationCampaign.objects.create(
            title='Hello',
            body='News',
            audience=NotificationCampaign.AUDIENCE_ALL,
        )

        self.assertEqual(
            set(campaign_audience(campaign).values_list('pk', flat=True)),
            {self.user_a.pk, self.user_b.pk},
        )

    def test_selected_audience_only_targets_selected_active_users(self):
        self.user_b.is_active = False
        self.user_b.save(update_fields=['is_active'])
        campaign = NotificationCampaign.objects.create(
            title='Hello',
            body='News',
            audience=NotificationCampaign.AUDIENCE_SELECTED,
        )
        campaign.recipients.add(self.user_a, self.user_b, self.staff)

        self.assertEqual(list(campaign_audience(campaign)), [self.user_a])

    @patch('social.campaigns.send_expo_push', return_value=1)
    def test_send_campaign_creates_feed_rows_and_pushes_once(self, send_push):
        DeviceToken.objects.create(
            user=self.user_a,
            token='ExponentPushToken[test-a]',
            platform=DeviceToken.PLATFORM_IOS,
        )
        campaign = NotificationCampaign.objects.create(
            title='New feature',
            body='Open MoneyBot to see what is new.',
            audience=NotificationCampaign.AUDIENCE_SELECTED,
        )
        campaign.recipients.add(self.user_a)

        sent = send_campaign(campaign)

        self.assertEqual(sent.status, NotificationCampaign.STATUS_SENT)
        self.assertEqual(sent.target_count, 1)
        self.assertEqual(sent.push_count, 1)
        notification = Notification.objects.get(campaign=campaign, recipient=self.user_a)
        self.assertEqual(notification.kind, Notification.TYPE_ANNOUNCEMENT)
        self.assertEqual(notification.data['campaign_id'], campaign.pk)
        send_push.assert_called_once()

        send_campaign(campaign)
        self.assertEqual(Notification.objects.filter(campaign=campaign).count(), 1)
        send_push.assert_called_once()

    def test_empty_audience_is_rejected_without_changing_status(self):
        campaign = NotificationCampaign.objects.create(
            title='Nobody',
            body='No recipients',
            audience=NotificationCampaign.AUDIENCE_SELECTED,
        )

        with self.assertRaisesMessage(ValueError, 'no active users'):
            send_campaign(campaign)

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, NotificationCampaign.STATUS_DRAFT)
