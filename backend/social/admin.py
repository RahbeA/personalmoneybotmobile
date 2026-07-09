from django.contrib import admin

from .models import (
    ChallengeParticipant,
    Friendship,
    Group,
    GroupChallenge,
    GroupInvite,
    GroupMembership,
    Notification,
    DeviceToken,
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
    list_display = ('recipient', 'kind', 'actor', 'is_read', 'created_at')
    list_filter = ('kind', 'is_read')
    search_fields = ('recipient__email', 'actor__email', 'title')


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'platform', 'token', 'updated_at')
    list_filter = ('platform',)
    search_fields = ('user__email', 'token')
