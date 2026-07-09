from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.serializers import UserStatsSerializer
from courses.views import client_today_from_request, get_or_create_stats
from moneybot.cache_utils import invalidate_leaderboard_snapshots, invalidate_user_cache

from . import arcade
from .catalog import (
    GAMES, PLAY_COST, NEW_BEST_BONUS, get_game, xp_for_score, bot_bucks_for_score,
)
from .models import GameSession, GameScore


def _serialize_catalog(best_scores):
    games = []
    for game in GAMES:
        entry = dict(game)
        entry['best_score'] = best_scores.get(game['key'], 0)
        games.append(entry)
    return games


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def arcade_catalog(request):
    """Return game catalog, Bot Bucks balance, and free-play status."""
    stats = get_or_create_stats(request.user)
    today = client_today_from_request(request)
    state = arcade.get_or_create_arcade_state(request.user)
    best_scores = arcade.best_scores_for_user(request.user)

    return Response({
        'games': _serialize_catalog(best_scores),
        'bot_bucks': stats.bot_bucks,
        'play_cost': PLAY_COST,
        'free_play_available': arcade.free_play_available(state, today),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_game(request, game_key):
    """Start a game session — spend Bot Bucks or consume daily free play."""
    game = get_game(game_key)
    if not game:
        return Response({'detail': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)
    if not game.get('playable'):
        return Response({'detail': 'This game is not available yet.'}, status=status.HTTP_400_BAD_REQUEST)

    today = client_today_from_request(request)
    stats = get_or_create_stats(request.user)
    state = arcade.get_or_create_arcade_state(request.user)

    was_free = False
    bot_bucks_spent = 0

    if arcade.free_play_available(state, today):
        arcade.consume_free_play(state, today)
        was_free = True
    else:
        if stats.bot_bucks < PLAY_COST:
            return Response(
                {'detail': f'Not enough Bot Bucks. You need {PLAY_COST} to play.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        stats.bot_bucks -= PLAY_COST
        bot_bucks_spent = PLAY_COST
        stats.save(update_fields=['bot_bucks'])

    session = GameSession.objects.create(
        user=request.user,
        game_key=game_key,
        bot_bucks_spent=bot_bucks_spent,
        was_free=was_free,
    )

    invalidate_user_cache(request.user.id)

    return Response({
        'session_id': session.id,
        'game_key': game_key,
        'bot_bucks': stats.bot_bucks,
        'was_free': was_free,
        'play_cost': PLAY_COST,
        'free_play_available': arcade.free_play_available(state, today),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finish_game(request, game_key):
    """Finish a game session — award XP based on score and record best."""
    game = get_game(game_key)
    if not game:
        return Response({'detail': 'Game not found.'}, status=status.HTTP_404_NOT_FOUND)

    session_id = request.data.get('session_id')
    if not session_id:
        return Response({'detail': 'session_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        score = int(request.data.get('score', 0))
    except (TypeError, ValueError):
        return Response({'detail': 'score must be an integer.'}, status=status.HTTP_400_BAD_REQUEST)

    score = max(0, score)

    try:
        session = GameSession.objects.get(
            id=session_id,
            user=request.user,
            game_key=game_key,
            status=GameSession.STATUS_OPEN,
        )
    except GameSession.DoesNotExist:
        return Response({'detail': 'Invalid or already closed session.'}, status=status.HTTP_400_BAD_REQUEST)

    xp_earned = xp_for_score(game_key, score)
    prior_best = arcade.best_score_for_game(request.user, game_key)

    is_best = score >= prior_best and score > 0

    # Bot Bucks payout: score tier reward + a bonus for beating a real prior best.
    bot_bucks_earned = bot_bucks_for_score(game_key, score)
    if is_best and prior_best > 0:
        bot_bucks_earned += NEW_BEST_BONUS

    session.status = GameSession.STATUS_CLOSED
    session.closed_at = timezone.now()
    session.save(update_fields=['status', 'closed_at'])

    GameScore.objects.create(
        user=request.user,
        game_key=game_key,
        score=score,
        xp_awarded=xp_earned,
        session=session,
    )

    stats = get_or_create_stats(request.user)
    update_fields = []
    if xp_earned:
        stats.xp += xp_earned
        update_fields.append('xp')
    if bot_bucks_earned:
        stats.bot_bucks += bot_bucks_earned
        update_fields.append('bot_bucks')
    if update_fields:
        stats.save(update_fields=update_fields)

    from courses.badges import evaluate_and_award
    evaluate_and_award(request.user, stats)

    invalidate_user_cache(request.user.id)
    invalidate_leaderboard_snapshots()

    best_score = max(prior_best, score)

    return Response({
        'xp_earned': xp_earned,
        'bot_bucks_earned': bot_bucks_earned,
        'score': score,
        'best_score': best_score,
        'is_best': is_best,
        'bot_bucks': stats.bot_bucks,
        'stats': UserStatsSerializer(stats, context={'request': request}).data,
    })
