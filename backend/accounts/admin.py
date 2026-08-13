from django.contrib import admin
from accounts.models import Invite, InviteClaim, InviteConfig, User


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active', 'is_staff', 'is_guest', 'date_joined')
    search_fields = ('email', 'name')
    list_filter = ('is_staff', 'is_guest', 'is_active')
    ordering = ('-date_joined',)


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ('code', 'created_by', 'uses_count', 'max_uses', 'is_revoked', 'created_at')
    list_filter = ('is_revoked',)
    search_fields = ('code', 'created_by__email', 'used_by__email', 'note')
    ordering = ('-created_at',)
    readonly_fields = ('code', 'created_at', 'used_at', 'uses_count')


@admin.register(InviteClaim)
class InviteClaimAdmin(admin.ModelAdmin):
    list_display = ('user', 'invite', 'rewarded', 'created_at')
    list_filter = ('rewarded',)
    search_fields = ('user__email', 'user__name', 'invite__code')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)


@admin.register(InviteConfig)
class InviteConfigAdmin(admin.ModelAdmin):
    list_display = ('invite_only_enabled', 'invites_per_user', 'updated_at')

    def has_add_permission(self, request):
        return not InviteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
