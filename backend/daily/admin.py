from django.contrib import admin, messages
from django.shortcuts import redirect, render
from django.urls import path

from . import importer
from .models import DailyChallenge, DailyEntry, DailyItem, DailyPlayerState


@admin.register(DailyItem)
class DailyItemAdmin(admin.ModelAdmin):
    list_display = ('item_id', 'round_type', 'prompt', 'is_active', 'updated_at')
    list_filter = ('round_type', 'is_active')
    list_editable = ('is_active',)
    search_fields = ('item_id', 'prompt')
    ordering = ('round_type', 'item_id')
    change_list_template = 'admin/daily/dailyitem/change_list.html'

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                'bulk-import/',
                self.admin_site.admin_view(self.bulk_import_view),
                name='daily_dailyitem_bulk_import',
            ),
        ]
        return custom + urls

    def bulk_import_view(self, request):
        context = {
            **self.admin_site.each_context(request),
            'title': 'Bulk import Daily items',
            'opts': self.model._meta,
            'ai_prompt': importer.AI_PROMPT,
            'raw': '',
        }

        if request.method == 'POST':
            raw = request.POST.get('payload', '')
            context['raw'] = raw
            try:
                created, updated = importer.import_json(raw)
            except importer.ImportError_ as exc:
                self.message_user(request, str(exc), level=messages.ERROR)
            else:
                self.message_user(
                    request,
                    f'Imported successfully: {created} created, {updated} updated.',
                    level=messages.SUCCESS,
                )
                return redirect('admin:daily_dailyitem_changelist')

        return render(request, 'admin/daily/dailyitem/bulk_import.html', context)


@admin.register(DailyChallenge)
class DailyChallengeAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'created_at')
    ordering = ('-date',)


@admin.register(DailyEntry)
class DailyEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'challenge', 'total_score', 'total_time_ms', 'created_at')
    list_filter = ('challenge',)
    search_fields = ('user__email',)


@admin.register(DailyPlayerState)
class DailyPlayerStateAdmin(admin.ModelAdmin):
    list_display = ('user', 'current_streak', 'best_streak', 'last_played_date', 'total_played')
    search_fields = ('user__email',)
