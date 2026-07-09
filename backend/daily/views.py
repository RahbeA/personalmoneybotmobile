from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.models import UserStats
from courses.onboarding import compute_rank
from courses.serializers import UserStatsSerializer
from courses.views import client_today_from_request, get_or_create_stats
from moneybot.cache_utils import invalidate_leaderboard_snapshots, invalidate_user_cache

from . import challenge as challenge_engine
from . import service
from .models import DailyEntry

LEADERBOARD_TOP_N = 20


def _seconds_until_reset(day):
    """Seconds until the user's local midnight (next puzzle unlocks)."""
    next_midnight = datetime.combine(day + timedelta(days=1), time.min)
    now_local = datetime.combine(day, timezone.localtime().time())
    delta = (next_midnight - now_local).total_seconds()
    return max(0, int(delta))


def _entry_rank(entry):
    """1-based rank of an entry within its challenge (score desc, time asc)."""
    better = DailyEntry.objects.filter(challenge=entry.challenge).filter(
        total_score__gt=entry.total_score,
    ).count()
    ties_faster = DailyEntry.objects.filter(
        challenge=entry.challenge,
        total_score=entry.total_score,
        total_time_ms__lt=entry.total_time_ms,
    ).count()
    return better + ties_faster + 1


def _my_entry_payload(entry):
    return {
        'total_score': entry.total_score,
        'total_time_ms': entry.total_time_ms,
        'grid': entry.grid,
        'results': entry.results,
        'xp_earned': entry.xp_awarded,
        'bot_bucks_earned': entry.bot_bucks_awarded,
        'rank': _entry_rank(entry),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_today(request):
    """Return today's puzzle (sanitized) plus the player's status."""
    today = client_today_from_request(request)
    challenge = service.get_or_create_challenge(today)
    state = service.get_or_create_state(request.user)

    entry = DailyEntry.objects.filter(challenge=challenge, user=request.user).first()

    data = {
        'number': challenge.number,
        'date': challenge.date.isoformat(),
        'max_score': challenge_engine.max_total(),
        'played': entry is not None,
        'current_streak': state.current_streak,
        'best_streak': state.best_streak,
        'total_played': state.total_played,
        'seconds_until_reset': _seconds_until_reset(today),
        'total_players': challenge.entries.count(),
    }

    if entry is not None:
        data['my_entry'] = _my_entry_payload(entry)
    else:
        data['challenge'] = challenge_engine.sanitize_payload(challenge.payload)

    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def daily_submit(request):
    """Score a submission, award rewards, advance streak. One attempt per day."""
    today = client_today_from_request(request)
    challenge = service.get_or_create_challenge(today)

    if DailyEntry.objects.filter(challenge=challenge, user=request.user).exists():
        return Response(
            {'detail': 'You already played today\u2019s challenge.'},
            status=status.HTTP_409_CONFLICT,
        )

    answers = request.data.get('answers')
    if not isinstance(answers, list):
        return Response({'detail': 'answers must be a list.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        total_time_ms = int(request.data.get('total_time_ms', 0))
    except (TypeError, ValueError):
        total_time_ms = 0
    total_time_ms = max(0, total_time_ms)

    total_score, results, grid = challenge_engine.score_submission(challenge.payload, answers)

    state = service.get_or_create_state(request.user)
    new_streak = service.register_play(state, today)
    xp_earned, bot_bucks_earned = service.compute_rewards(total_score, new_streak)

    stats = get_or_create_stats(request.user)

    try:
        with transaction.atomic():
            entry = DailyEntry.objects.create(
                user=request.user,
                challenge=challenge,
                total_score=total_score,
                total_time_ms=total_time_ms,
                results=results,
                grid=grid,
                xp_awarded=xp_earned,
                bot_bucks_awarded=bot_bucks_earned,
            )
            stats.xp += xp_earned
            stats.bot_bucks += bot_bucks_earned
            stats.save(update_fields=['xp', 'bot_bucks'])
    except IntegrityError:
        # Lost a race with a concurrent submit — treat as already played.
        return Response(
            {'detail': 'You already played today\u2019s challenge.'},
            status=status.HTTP_409_CONFLICT,
        )

    from courses.badges import evaluate_and_award
    evaluate_and_award(request.user, stats)

    invalidate_user_cache(request.user.id)
    invalidate_leaderboard_snapshots()

    return Response({
        'number': challenge.number,
        'total_score': total_score,
        'max_score': challenge_engine.max_total(),
        'total_time_ms': total_time_ms,
        'grid': grid,
        'results': results,
        'rank': _entry_rank(entry),
        'total_players': challenge.entries.count(),
        'xp_earned': xp_earned,
        'bot_bucks_earned': bot_bucks_earned,
        'current_streak': state.current_streak,
        'best_streak': state.best_streak,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })


def _serialize_lb_entry(entry, rank, stats_by_user, request):
    user = entry.user
    stats = stats_by_user.get(user.id)
    name = (user.name or '').strip()
    display_name = name if name else user.email.split('@')[0]

    equipped = None
    onboarding_score = 0
    xp = 0
    if stats is not None:
        onboarding_score = stats.onboarding_score
        xp = stats.xp
        if stats.equipped_character_id:
            from moneyverse.serializers import CharacterSerializer
            equipped = CharacterSerializer(stats.equipped_character, context={'request': request}).data

    return {
        'rank': rank,
        'user_id': user.id,
        'display_name': display_name,
        'score': entry.total_score,
        'time_ms': entry.total_time_ms,
        'grid': entry.grid,
        'rank_tier': compute_rank(onboarding_score, xp),
        'equipped_character': equipped,
        'is_me': request.user.id == user.id,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_leaderboard(request):
    """Today's leaderboard: top players + the requesting user's own row."""
    today = client_today_from_request(request)
    challenge = service.get_or_create_challenge(today)

    ranked = list(
        DailyEntry.objects.filter(challenge=challenge)
        .select_related('user')
        .order_by('-total_score', 'total_time_ms', 'created_at')
    )

    user_ids = [e.user_id for e in ranked]
    stats_by_user = {
        s.user_id: s
        for s in UserStats.objects.filter(user_id__in=user_ids).select_related('equipped_character')
    }

    top = ranked[:LEADERBOARD_TOP_N]
    top_entries = [
        _serialize_lb_entry(e, i + 1, stats_by_user, request)
        for i, e in enumerate(top)
    ]

    me = None
    my_index = next((i for i, e in enumerate(ranked) if e.user_id == request.user.id), None)
    if my_index is not None and my_index >= LEADERBOARD_TOP_N:
        me = _serialize_lb_entry(ranked[my_index], my_index + 1, stats_by_user, request)

    return Response({
        'number': challenge.number,
        'date': challenge.date.isoformat(),
        'total_players': len(ranked),
        'top': top_entries,
        'me': me,
    })
