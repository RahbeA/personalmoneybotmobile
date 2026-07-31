"""Daily login reward ladder (Bot Bucks for consecutive daily claims)."""
from datetime import date, timedelta

from .models import DailyRewardTier, UserStats

DEFAULT_TIERS = [5, 10, 15, 20, 30, 40, 75]


def get_tier_map():
    tiers = list(DailyRewardTier.objects.order_by('day'))
    if len(tiers) >= 7:
        return {t.day: t.bot_bucks for t in tiers}
    return {i + 1: DEFAULT_TIERS[i] for i in range(7)}


def get_tier_list():
    tier_map = get_tier_map()
    return [{'day': d, 'bot_bucks': tier_map.get(d, DEFAULT_TIERS[d - 1])} for d in range(1, 8)]


def _normalize_reward_day(stats, today):
    """Reset ladder to day 1 if the user missed a claim day."""
    if stats.last_daily_claim is None:
        stats.daily_reward_day = max(1, min(stats.daily_reward_day or 1, 7))
        return
    if stats.last_daily_claim >= today - timedelta(days=1):
        return
    stats.daily_reward_day = 1
    stats.daily_claim_streak = 0


def effective_streak(stats, today=None):
    """Flame streak as of ``today``; a run that ended before yesterday is over.

    ``streak_days`` is only rewritten when the user acts, so a lapsed user would
    otherwise keep showing a stale number on Home while the reward ladder had
    already reset to day 1.
    """
    today = today or date.today()
    streak = stats.streak_days or 0
    if streak <= 0 or stats.last_active is None:
        return 0
    if stats.last_active < today - timedelta(days=1):
        return 0
    return streak


def ladder_day(stats, today):
    """Which rung of the 1–7 ladder ``today`` is for this user.

    Derived from the flame streak (``streak_days`` / ``last_active``) rather
    than tracked separately, so the "Day N" card can never disagree with the
    streak pill on Home — they are the same number by construction.
    """
    streak = stats.streak_days or 0
    if streak <= 0 or stats.last_active is None:
        day_index = 1
    elif stats.last_active == today:
        # Already engaged today, so today *is* streak day `streak`.
        day_index = streak
    elif stats.last_active == today - timedelta(days=1):
        # Streak is alive; engaging today extends it by one.
        day_index = streak + 1
    else:
        day_index = 1
    return ((max(day_index, 1) - 1) % 7) + 1


def daily_reward_status(stats, today=None):
    """Build payload for GET stats / UI.

    ``today`` is the device-local date so the daily-claim streak resets at the
    user's local midnight; it defaults to the server date (UTC) when omitted.
    """
    today = today or date.today()
    _normalize_reward_day(stats, today)
    tier_map = get_tier_map()
    tiers = get_tier_list()
    day = ladder_day(stats, today)
    claimed_today = stats.last_daily_claim == today
    can_claim = not claimed_today
    claim_amount = tier_map.get(day, DEFAULT_TIERS[day - 1]) if can_claim else 0

    return {
        'tiers': tiers,
        'current_day': day,
        'claim_amount': claim_amount,
        'can_claim': can_claim,
        'claimed_today': claimed_today,
        'daily_claim_streak': stats.daily_claim_streak,
    }


def claim_daily_reward(user, stats, today=None):
    """Claim today's Bot Bucks. Returns (amount, status_dict).

    ``today`` is the device-local date (falls back to the server date).
    """
    today = today or date.today()
    _normalize_reward_day(stats, today)
    # Legacy rows where the flame lagged behind an active claim streak: reconcile
    # first so the rung we charge for matches the streak we end up storing.
    if stats.last_daily_claim and stats.last_daily_claim >= today - timedelta(days=1):
        stats.streak_days = max(stats.streak_days or 0, stats.daily_claim_streak or 0)
    status = daily_reward_status(stats, today)
    if not status['can_claim']:
        raise ValueError('Daily reward already claimed today.')

    # Resolve the rung before mutating the streak below — `ladder_day` reads
    # last_active/streak_days and would otherwise see today's own update.
    day = status['current_day']
    tier_map = get_tier_map()
    amount = tier_map.get(day, DEFAULT_TIERS[day - 1])
    prior_claim = stats.last_daily_claim
    yesterday = today - timedelta(days=1)

    stats.bot_bucks += amount
    stats.last_daily_claim = today
    if prior_claim == yesterday:
        stats.daily_claim_streak = (stats.daily_claim_streak or 0) + 1
    else:
        stats.daily_claim_streak = 1

    # Claiming the daily reward is a daily-engagement action, so it should keep
    # the flame streak (streak_days) shown on Home alive just like completing a
    # lesson does. Without this, users who log in and claim every day still saw
    # their streak stuck at 1 because streak_days only advanced on lessons.
    if stats.last_active == yesterday:
        stats.streak_days = (stats.streak_days or 0) + 1
    elif stats.last_active != today:
        stats.streak_days = 1
    stats.last_active = today
    # The consecutive daily-claim streak is, by definition, a run of engaged
    # days, so the flame should never lag behind it (also reconciles existing
    # users whose streak_days was stuck before this change).
    stats.streak_days = max(stats.streak_days or 0, stats.daily_claim_streak or 0)
    # Kept in sync for badge criteria ("reward tier reached"); the UI reads the
    # streak-derived rung instead.
    stats.daily_reward_day = ladder_day(stats, today)

    stats.save(update_fields=[
        'bot_bucks', 'last_daily_claim', 'daily_reward_day', 'daily_claim_streak',
        'streak_days', 'last_active',
    ])

    from .badges import evaluate_and_award
    evaluate_and_award(user, stats)

    return amount, daily_reward_status(stats, today)
