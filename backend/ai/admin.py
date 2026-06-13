from django.contrib import admin
from .models import (
    UserAIProfile, TutorConversation, TutorMessage,
    MoneyChatSession, MoneyChatMessage,
)


@admin.register(UserAIProfile)
class UserAIProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'updated_at')
    search_fields = ('user__email',)


class TutorMessageInline(admin.TabularInline):
    model = TutorMessage
    extra = 0
    readonly_fields = ('role', 'content', 'created_at')


@admin.register(TutorConversation)
class TutorConversationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'updated_at')
    search_fields = ('user__email', 'title')
    inlines = [TutorMessageInline]


class MoneyChatMessageInline(admin.TabularInline):
    model = MoneyChatMessage
    extra = 0
    readonly_fields = ('role', 'content', 'created_at')


@admin.register(MoneyChatSession)
class MoneyChatSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'module', 'status', 'passed', 'bonus_awarded', 'created_at')
    list_filter = ('status', 'passed', 'module')
    search_fields = ('user__email',)
    inlines = [MoneyChatMessageInline]
