from django.conf import settings
from django.db import models


class ArcadePlayerState(models.Model):
    """Per-user arcade state (daily free play tracking)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='arcade_state',
    )
    last_free_play_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f'Arcade state for {self.user.email}'


class GameSession(models.Model):
    """Open/closed play session — prevents score replay and ties spend to finish."""

    STATUS_OPEN = 'open'
    STATUS_CLOSED = 'closed'
    STATUS_CHOICES = [
        (STATUS_OPEN, 'Open'),
        (STATUS_CLOSED, 'Closed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='game_sessions',
    )
    game_key = models.CharField(max_length=40)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_OPEN)
    bot_bucks_spent = models.PositiveIntegerField(default=0)
    was_free = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'game_key', 'status']),
        ]

    def __str__(self):
        return f'{self.user.email} — {self.game_key} ({self.status})'


class GameScore(models.Model):
    """Per-play score history."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='game_scores',
    )
    game_key = models.CharField(max_length=40)
    score = models.PositiveIntegerField(default=0)
    xp_awarded = models.PositiveIntegerField(default=0)
    session = models.ForeignKey(
        GameSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='scores',
    )
    played_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'game_key', '-score']),
        ]
        ordering = ['-played_at']

    def __str__(self):
        return f'{self.user.email} — {self.game_key}: {self.score}'
