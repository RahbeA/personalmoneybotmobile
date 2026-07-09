from django.contrib import admin

from .models import ArcadePlayerState, GameSession, GameScore


@admin.register(ArcadePlayerState)
class ArcadePlayerStateAdmin(admin.ModelAdmin):
    list_display = ('user', 'last_free_play_date')
    search_fields = ('user__email',)


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'game_key', 'status', 'bot_bucks_spent', 'was_free', 'created_at', 'closed_at')
    list_filter = ('status', 'game_key', 'was_free')
    search_fields = ('user__email',)


@admin.register(GameScore)
class GameScoreAdmin(admin.ModelAdmin):
    list_display = ('user', 'game_key', 'score', 'xp_awarded', 'played_at')
    list_filter = ('game_key',)
    search_fields = ('user__email',)
