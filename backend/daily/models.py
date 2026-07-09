from django.conf import settings
from django.db import models


class DailyItem(models.Model):
    """A single reusable round for the Daily puzzle content bank.

    Items are authored in the admin (or bulk-imported from AI-generated JSON) and
    the daily puzzle for each date is assembled deterministically from the pool of
    active items. ``data`` holds the round-type-specific fields; the exact shape
    per type is documented in ``daily/importer.py``.
    """

    ESTIMATE = 'estimate'
    HIGHER_LOWER = 'higher_lower'
    SEQUENCE = 'sequence'
    ROUND_TYPES = [
        (ESTIMATE, 'Estimate (guess a number)'),
        (HIGHER_LOWER, 'Higher / Lower (pick the bigger)'),
        (SEQUENCE, 'Sequence (put in order)'),
    ]

    round_type = models.CharField(max_length=20, choices=ROUND_TYPES)
    item_id = models.SlugField(
        max_length=64,
        unique=True,
        help_text='Stable unique id, e.g. "est_coffee". Reusing an id updates that item.',
    )
    prompt = models.CharField(max_length=300)
    data = models.JSONField(
        default=dict,
        blank=True,
        help_text='Round-specific fields (value/unit/min/max, a/b/answer, items/order, fact…).',
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Only active items are eligible to appear in daily puzzles.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['round_type', 'item_id']
        indexes = [models.Index(fields=['round_type', 'is_active'])]

    def __str__(self):
        return f'[{self.round_type}] {self.item_id}'

    def as_item(self):
        """Return the dict shape the puzzle engine expects."""
        item = dict(self.data or {})
        item['id'] = self.item_id
        item['prompt'] = self.prompt
        return item


class DailyChallenge(models.Model):
    """One puzzle per calendar date, shared by every user.

    ``payload`` stores the fully-generated rounds INCLUDING answers so scoring
    stays stable even if the content pool changes later in the day.
    """

    date = models.DateField(unique=True)
    number = models.PositiveIntegerField()
    payload = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f'Daily #{self.number} ({self.date})'


class DailyEntry(models.Model):
    """A user's single attempt at a given day's challenge (one per day)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_entries',
    )
    challenge = models.ForeignKey(
        DailyChallenge,
        on_delete=models.CASCADE,
        related_name='entries',
    )
    total_score = models.PositiveIntegerField(default=0)
    total_time_ms = models.PositiveIntegerField(default=0)
    results = models.JSONField(default=list)
    grid = models.CharField(max_length=64, blank=True, default='')
    xp_awarded = models.PositiveIntegerField(default=0)
    bot_bucks_awarded = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # One attempt per user per day — the whole point of a daily.
        unique_together = ('user', 'challenge')
        ordering = ['-total_score', 'total_time_ms', 'created_at']
        indexes = [
            models.Index(fields=['challenge', '-total_score', 'total_time_ms']),
        ]

    def __str__(self):
        return f'{self.user.email} — {self.challenge}: {self.total_score}'


class DailyPlayerState(models.Model):
    """Per-user streak/history for the daily challenge."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_state',
    )
    current_streak = models.PositiveIntegerField(default=0)
    best_streak = models.PositiveIntegerField(default=0)
    last_played_date = models.DateField(null=True, blank=True)
    total_played = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'Daily state for {self.user.email} (streak {self.current_streak})'
