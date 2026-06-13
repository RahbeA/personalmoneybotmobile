from django.contrib import admin
from .models import Character, UserCharacter


@admin.register(Character)
class CharacterAdmin(admin.ModelAdmin):
    list_display = ('order', 'name', 'rarity', 'price', 'is_active')
    list_editable = ('price', 'is_active')
    list_filter = ('rarity', 'is_active')
    search_fields = ('name',)
    ordering = ('order', 'id')


@admin.register(UserCharacter)
class UserCharacterAdmin(admin.ModelAdmin):
    list_display = ('user', 'character', 'acquired_at')
    list_filter = ('character',)
    search_fields = ('user__email', 'character__name')
