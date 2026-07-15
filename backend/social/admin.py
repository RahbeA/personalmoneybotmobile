from django import forms
from django.contrib import admin, messages

from .campaigns import send_campaign
from .models import (
    ChallengeParticipant,
    DeviceToken,
    Friendship,
    Group,
    GroupChallenge,
    GroupInvite,
    GroupMembership,
    Notification,
    NotificationCampaign,
)


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    list_display = ('requester', 'addressee', 'status', 'created_at', 'responded_at')
    list_filter = ('status',)
    search_fields = ('requester__email', 'addressee__email')


class GroupMembershipInline(admin.TabularInline):
    model = GroupMembership
    extra = 0


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'emoji', 'owner', 'created_at')
    search_fields = ('name', 'owner__email')
    inlines = [GroupMembershipInline]


@admin.register(GroupInvite)
class GroupInviteAdmin(admin.ModelAdmin):
    list_display = ('group', 'invited_user', 'invited_by', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('group__name', 'invited_user__email')


class ChallengeParticipantInline(admin.TabularInline):
    model = ChallengeParticipant
    extra = 0


@admin.register(GroupChallenge)
class GroupChallengeAdmin(admin.ModelAdmin):
    list_display = ('title', 'group', 'metric', 'target', 'starts_at', 'ends_at')
    list_filter = ('metric',)
    inlines = [ChallengeParticipantInline]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'kind', 'campaign', 'actor', 'is_read', 'created_at')
    list_filter = ('kind', 'is_read', 'campaign')
    search_fields = ('recipient__email', 'actor__email', 'title', 'body')
    readonly_fields = (
        'recipient', 'actor', 'kind', 'title', 'body', 'data',
        'campaign', 'is_read', 'created_at',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class NotificationCampaignAdminForm(forms.ModelForm):
    send_now = forms.BooleanField(
        required=False,
        initial=True,
        label='Send immediately',
        help_text='Uncheck to save this campaign as a draft without notifying anyone.',
    )

    class Meta:
        model = NotificationCampaign
        fields = (
            'title', 'body', 'audience', 'recipients', 'include_staff',
            'send_push', 'data',
        )
        widgets = {
            'body': forms.Textarea(attrs={'rows': 4}),
            'data': forms.Textarea(attrs={
                'rows': 4,
                'placeholder': '{\n  "screen": "Home"\n}',
            }),
        }

    def clean(self):
        cleaned = super().clean()
        audience = cleaned.get('audience')
        recipients = cleaned.get('recipients')
        data = cleaned.get('data')
        if audience == NotificationCampaign.AUDIENCE_SELECTED and not recipients:
            self.add_error('recipients', 'Choose at least one user for the selected-users audience.')
        if data is not None and not isinstance(data, dict):
            self.add_error('data', 'Routing data must be a JSON object.')
        return cleaned


@admin.register(NotificationCampaign)
class NotificationCampaignAdmin(admin.ModelAdmin):
    form = NotificationCampaignAdminForm
    list_display = (
        'title', 'audience', 'status', 'target_count', 'push_count',
        'send_push', 'created_by', 'created_at', 'sent_at',
    )
    list_filter = ('status', 'audience', 'send_push', 'created_at')
    search_fields = ('title', 'body', 'created_by__email')
    autocomplete_fields = ('recipients',)
    date_hierarchy = 'created_at'
    readonly_fields = (
        'status', 'target_count', 'push_count', 'error_message',
        'created_by', 'created_at', 'sent_at',
    )
    actions = ('send_draft_campaigns',)
    fieldsets = (
        ('Message', {'fields': ('title', 'body')}),
        ('Audience', {'fields': ('audience', 'recipients', 'include_staff')}),
        ('Delivery', {'fields': ('send_push', 'data')}),
        ('Send', {'fields': ('send_now',)}),
        ('Results', {
            'fields': (
                'status', 'target_count', 'push_count', 'error_message',
                'created_by', 'created_at', 'sent_at',
            ),
            'classes': ('collapse',),
        }),
    )

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        campaign = form.instance
        if form.cleaned_data.get('send_now') and campaign.status in (
            NotificationCampaign.STATUS_DRAFT,
            NotificationCampaign.STATUS_FAILED,
        ):
            try:
                sent = send_campaign(campaign)
            except ValueError as exc:
                self.message_user(request, str(exc), level=messages.ERROR)
            except Exception as exc:
                self.message_user(
                    request,
                    f'Campaign saved, but delivery failed: {exc}',
                    level=messages.ERROR,
                )
            else:
                self.message_user(
                    request,
                    (
                        f'Sent “{sent.title}” to {sent.target_count} users; '
                        f'{sent.push_count} registered devices were submitted for push delivery.'
                    ),
                    level=messages.SUCCESS,
                )

    @admin.action(description='Send selected draft/failed campaigns')
    def send_draft_campaigns(self, request, queryset):
        sent_count = 0
        for campaign in queryset:
            try:
                send_campaign(campaign)
            except ValueError as exc:
                self.message_user(
                    request,
                    f'“{campaign.title}” was not sent: {exc}',
                    level=messages.WARNING,
                )
            except Exception as exc:
                self.message_user(
                    request,
                    f'“{campaign.title}” failed: {exc}',
                    level=messages.ERROR,
                )
            else:
                sent_count += 1
        if sent_count:
            self.message_user(
                request,
                f'Successfully sent {sent_count} campaign(s).',
                level=messages.SUCCESS,
            )


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'platform', 'token', 'updated_at')
    list_filter = ('platform',)
    search_fields = ('user__email', 'token')
