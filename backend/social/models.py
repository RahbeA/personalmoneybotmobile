from django.conf import settings
from django.db import models


class NotificationCampaign(models.Model):
    """An admin-authored notification delivered to a controlled audience."""

    AUDIENCE_ALL = 'all'
    AUDIENCE_SELECTED = 'selected'
    AUDIENCE_IOS = 'ios'
    AUDIENCE_ANDROID = 'android'
    AUDIENCE_CHOICES = [
        (AUDIENCE_ALL, 'All active users'),
        (AUDIENCE_SELECTED, 'Selected users'),
        (AUDIENCE_IOS, 'Active users with an iOS device'),
        (AUDIENCE_ANDROID, 'Active users with an Android device'),
    ]

    STATUS_DRAFT = 'draft'
    STATUS_SENDING = 'sending'
    STATUS_SENT = 'sent'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Draft'),
        (STATUS_SENDING, 'Sending'),
        (STATUS_SENT, 'Sent'),
        (STATUS_FAILED, 'Failed'),
    ]

    title = models.CharField(max_length=140)
    body = models.CharField(max_length=280)
    audience = models.CharField(
        max_length=16,
        choices=AUDIENCE_CHOICES,
        default=AUDIENCE_SELECTED,
    )
    recipients = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='admin_notification_campaigns',
        help_text='Used only when the audience is “Selected users”.',
    )
    include_staff = models.BooleanField(
        default=False,
        help_text='Include staff/admin accounts in this campaign.',
    )
    send_push = models.BooleanField(
        default=True,
        help_text='Also send an OS push to registered devices. An in-app notification is always created.',
    )
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Optional routing data for the mobile app, as a JSON object.',
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    target_count = models.PositiveIntegerField(default=0)
    push_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_notification_campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Friendship(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_DECLINED = 'declined'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_DECLINED, 'Declined'),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendships_sent',
    )
    addressee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendships_received',
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['requester', 'addressee'], name='unique_friendship_pair'),
        ]
        indexes = [
            models.Index(fields=['requester', 'status']),
            models.Index(fields=['addressee', 'status']),
        ]

    def __str__(self):
        return f'{self.requester_id} -> {self.addressee_id} ({self.status})'


class Notification(models.Model):
    """A lightweight, per-user notification feed (friend requests, etc.)."""

    TYPE_FRIEND_REQUEST = 'friend_request'
    TYPE_FRIEND_ACCEPTED = 'friend_accepted'
    TYPE_FRIEND_DECLINED = 'friend_declined'
    TYPE_FRIEND_NUDGE = 'friend_nudge'
    TYPE_INVITE_REWARD = 'invite_reward'
    TYPE_ANNOUNCEMENT = 'announcement'
    TYPE_CHOICES = [
        (TYPE_FRIEND_REQUEST, 'Friend request received'),
        (TYPE_FRIEND_ACCEPTED, 'Friend request accepted'),
        (TYPE_FRIEND_DECLINED, 'Friend request declined'),
        (TYPE_FRIEND_NUDGE, 'Friend nudge'),
        (TYPE_INVITE_REWARD, 'Invite reward earned'),
        (TYPE_ANNOUNCEMENT, 'Admin announcement'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications_triggered',
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=32, choices=TYPE_CHOICES)
    title = models.CharField(max_length=140)
    body = models.CharField(max_length=280, blank=True)
    # Arbitrary routing payload for the client, e.g. {"request_id": 12, "user_id": 3}.
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    campaign = models.ForeignKey(
        NotificationCampaign,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', '-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'recipient'],
                condition=models.Q(campaign__isnull=False),
                name='unique_campaign_notification_recipient',
            ),
        ]

    def __str__(self):
        return f'{self.kind} -> {self.recipient_id}'


class FriendNudge(models.Model):
    """One nudge per friend pair per calendar day (client-local date)."""

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nudges_sent',
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nudges_received',
    )
    day = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['sender', 'recipient', 'day'],
                name='unique_friend_nudge_per_day',
            ),
        ]
        indexes = [
            models.Index(fields=['sender', 'day']),
            models.Index(fields=['recipient', 'day']),
        ]

    def __str__(self):
        return f'{self.sender_id} nudged {self.recipient_id} on {self.day}'


class DeviceToken(models.Model):
    """An Expo push token registered for a user's device (for remote push)."""

    PLATFORM_IOS = 'ios'
    PLATFORM_ANDROID = 'android'
    PLATFORM_CHOICES = [
        (PLATFORM_IOS, 'iOS'),
        (PLATFORM_ANDROID, 'Android'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='device_tokens',
    )
    token = models.CharField(max_length=255, unique=True)
    platform = models.CharField(max_length=16, choices=PLATFORM_CHOICES, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f'{self.user_id}: {self.token[:24]}…'


class Group(models.Model):
    name = models.CharField(max_length=80)
    emoji = models.CharField(max_length=16, default='people')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_groups',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class GroupMembership(models.Model):
    ROLE_OWNER = 'owner'
    ROLE_MEMBER = 'member'
    ROLE_CHOICES = [
        (ROLE_OWNER, 'Owner'),
        (ROLE_MEMBER, 'Member'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_memberships',
    )
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['group']),
        ]

    def __str__(self):
        return f'{self.user_id} in {self.group_id} ({self.role})'


class GroupInvite(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_ACCEPTED = 'accepted'
    STATUS_DECLINED = 'declined'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_ACCEPTED, 'Accepted'),
        (STATUS_DECLINED, 'Declined'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invites')
    invited_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_invites_received',
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_invites_sent',
    )
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['group', 'invited_user'], name='unique_group_invite'),
        ]
        indexes = [
            models.Index(fields=['invited_user', 'status']),
            models.Index(fields=['group', 'status']),
        ]

    def __str__(self):
        return f'{self.invited_user_id} -> {self.group_id} ({self.status})'


class GroupChallenge(models.Model):
    METRIC_XP = 'xp'
    METRIC_LESSONS = 'lessons_completed'
    METRIC_DAILY = 'daily_points'
    METRIC_STREAK = 'streak_days'
    METRIC_CHOICES = [
        (METRIC_XP, 'XP earned'),
        (METRIC_LESSONS, 'Lessons completed'),
        (METRIC_DAILY, 'Daily challenge points'),
        (METRIC_STREAK, 'Streak days'),
    ]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='challenges')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_challenges',
    )
    title = models.CharField(max_length=120)
    metric = models.CharField(max_length=32, choices=METRIC_CHOICES)
    target = models.PositiveIntegerField()
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['group', '-ends_at']),
        ]

    def __str__(self):
        return f'{self.title} ({self.group.name})'

    @property
    def is_active(self):
        from django.utils import timezone
        now = timezone.now()
        return self.starts_at <= now <= self.ends_at


class ChallengeParticipant(models.Model):
    challenge = models.ForeignKey(
        GroupChallenge,
        on_delete=models.CASCADE,
        related_name='participants',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='challenge_participations',
    )
    baseline_value = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('challenge', 'user')
        indexes = [
            models.Index(fields=['challenge']),
        ]

    def __str__(self):
        return f'{self.user_id} in challenge {self.challenge_id}'
