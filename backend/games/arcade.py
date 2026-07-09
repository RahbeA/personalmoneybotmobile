"""Arcade economy helpers (free play, best scores)."""
from datetime import date

from django.db.models import Max

from .models import ArcadePlayerState, GameScore


def get_or_create_arcade_state(user):
    state, _ = ArcadePlayerState.objects.get_or_create(user=user)
    return state


def free_play_available(state, today=None):
    today = today or date.today()
    return state.last_free_play_date != today


def consume_free_play(state, today=None):
    today = today or date.today()
    state.last_free_play_date = today
    state.save(update_fields=['last_free_play_date'])


def best_scores_for_user(user):
    rows = (
        GameScore.objects.filter(user=user)
        .values('game_key')
        .annotate(best=Max('score'))
    )
    return {row['game_key']: row['best'] for row in rows}


def best_score_for_game(user, game_key):
    return (
        GameScore.objects.filter(user=user, game_key=game_key)
        .aggregate(best=Max('score'))['best']
    ) or 0
