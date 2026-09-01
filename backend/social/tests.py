from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .campaigns import campaign_audience, send_campaign
from .models import DeviceToken, FeedPost, FeedPostUpvote, Friendship, FriendNudge, Notification, NotificationCampaign
from .push import PushResult


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

    @patch(
        'social.campaigns.send_expo_push',
        return_value=PushResult(attempted=1, accepted=1),
    )
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
        self.assertTrue(send_push.call_args.kwargs.get('raise_on_failure'))

        send_campaign(campaign)
        self.assertEqual(Notification.objects.filter(campaign=campaign).count(), 1)
        send_push.assert_called_once()

    def test_send_campaign_fails_when_push_requested_but_no_tokens(self):
        campaign = NotificationCampaign.objects.create(
            title='Push me',
            body='Hello',
            audience=NotificationCampaign.AUDIENCE_SELECTED,
            send_push=True,
        )
        campaign.recipients.add(self.user_a)

        with self.assertRaises(RuntimeError):
            send_campaign(campaign)

        campaign.refresh_from_db()
        self.assertEqual(campaign.status, NotificationCampaign.STATUS_FAILED)
        self.assertIn('Expo push token', campaign.error_message)
        self.assertEqual(
            Notification.objects.filter(campaign=campaign, recipient=self.user_a).count(),
            1,
        )

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


class FriendNudgeTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user_a = User.objects.create_user(email='nudge_a@example.com', password='test')
        self.user_b = User.objects.create_user(email='nudge_b@example.com', password='test')
        Friendship.objects.create(
            requester=self.user_a,
            addressee=self.user_b,
            status=Friendship.STATUS_ACCEPTED,
            responded_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user_a)

    @patch('social.push.send_expo_push', return_value=PushResult(attempted=1, accepted=1))
    def test_nudge_friend_once_per_day(self, _send):
        DeviceToken.objects.create(
            user=self.user_b,
            token='ExponentPushToken[nudge-b]',
            platform=DeviceToken.PLATFORM_IOS,
        )
        day = timezone.now().date().isoformat()
        res = self.client.post(
            f'/api/social/users/{self.user_b.id}/nudge/',
            {'client_date': day},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'nudged')
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.user_b,
                kind=Notification.TYPE_FRIEND_NUDGE,
                actor=self.user_a,
            ).exists()
        )

        again = self.client.post(
            f'/api/social/users/{self.user_b.id}/nudge/',
            {'client_date': day},
            format='json',
        )
        self.assertEqual(again.status_code, 429)
        self.assertEqual(FriendNudge.objects.filter(sender=self.user_a, recipient=self.user_b).count(), 1)

    def test_nudge_requires_friendship(self):
        User = get_user_model()
        stranger = User.objects.create_user(email='stranger@example.com', password='test')
        res = self.client.post(f'/api/social/users/{stranger.id}/nudge/', format='json')
        self.assertEqual(res.status_code, 403)


class FeedUpvoteTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.author = User.objects.create_user(email='feed_author@example.com', password='test')
        self.voter = User.objects.create_user(email='feed_voter@example.com', password='test')
        self.post = FeedPost.objects.create(
            author=self.author,
            image='feed/test.jpg',
            caption='Save more',
            status=FeedPost.STATUS_APPROVED,
        )
        self.pending = FeedPost.objects.create(
            author=self.author,
            image='feed/pending.jpg',
            caption='Pending tip',
            status=FeedPost.STATUS_PENDING,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.voter)

    def test_toggle_upvote_on_approved_post(self):
        res = self.client.post(f'/api/social/feed/{self.post.id}/upvote/', {}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['has_upvoted'])
        self.assertEqual(res.data['upvote_count'], 1)
        self.assertEqual(FeedPostUpvote.objects.filter(post=self.post).count(), 1)

        again = self.client.post(f'/api/social/feed/{self.post.id}/upvote/', {}, format='json')
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.data['has_upvoted'])
        self.assertEqual(again.data['upvote_count'], 0)

    def test_cannot_upvote_pending_post(self):
        res = self.client.post(f'/api/social/feed/{self.pending.id}/upvote/', {}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_feed_list_includes_upvote_fields(self):
        FeedPostUpvote.objects.create(post=self.post, user=self.voter)
        res = self.client.get('/api/social/feed/')
        self.assertEqual(res.status_code, 200)
        row = next(item for item in res.data['results'] if item['id'] == self.post.id)
        self.assertEqual(row['upvote_count'], 1)
        self.assertTrue(row['has_upvoted'])

    def test_guest_cannot_upvote(self):
        User = get_user_model()
        guest = User.objects.create_user(email='guest@example.com', password='test', is_guest=True)
        guest_client = APIClient()
        guest_client.force_authenticate(user=guest)
        res = guest_client.post(f'/api/social/feed/{self.post.id}/upvote/', {}, format='json')
        self.assertEqual(res.status_code, 403)
