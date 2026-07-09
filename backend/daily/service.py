"""Business logic for the daily challenge: challenge creation, rewards, streaks."""
from datetime import timedelta

from . import challenge as challenge_engine
from .models import DailyChallenge, DailyPlayerState

# Reward tuning. A full-marks run earns the top of each range.
BASE_XP = 10
MAX_BONUS_XP = 40
BASE_BOT_BUCKS = 10
MAX_BONUS_BOT_BUCKS = 20
STREAK_BONUS_CAP = 7  # extra Bot Bucks, +1 per streak day up to this cap


def get_or_create_challenge(day):
    """Fetch (or lazily create) the shared puzzle for ``day``."""
    try:
        return DailyChallenge.objects.get(date=day)
    except DailyChallenge.DoesNotExist:
        payload = challenge_engine.build_payload(day)
        obj, _ = DailyChallenge.objects.get_or_create(
            date=day,
            defaults={
                'number': challenge_engine.challenge_number(day),
                'payload': payload,
            },
        )
        return obj


def compute_rewards(total_score, current_streak):
    max_total = challenge_engine.max_total()
    frac = (total_score / max_total) if max_total else 0
    xp = BASE_XP + round(MAX_BONUS_XP * frac)
    bot_bucks = BASE_BOT_BUCKS + round(MAX_BONUS_BOT_BUCKS * frac)
    streak_bonus = min(max(current_streak - 1, 0), STREAK_BONUS_CAP)
    bot_bucks += streak_bonus
    return xp, bot_bucks


def get_or_create_state(user):
    state, _ = DailyPlayerState.objects.get_or_create(user=user)
    return state


def register_play(state, day):
    """Advance the daily streak for a play on ``day``. Returns the new streak."""
    last = state.last_played_date
    if last == day:
        # Shouldn't happen (one attempt/day) but keep idempotent.
        return state.current_streak
    if last == day - timedelta(days=1):
        state.current_streak += 1
    else:
        state.current_streak = 1
    state.best_streak = max(state.best_streak, state.current_streak)
    state.last_played_date = day
    state.total_played += 1
    state.save(update_fields=[
        'current_streak', 'best_streak', 'last_played_date', 'total_played',
    ])
    return state.current_streak
