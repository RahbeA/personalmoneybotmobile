from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSuperUser(BasePermission):
    """Only Django superusers may perform unsafe operations."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsAdminUserOrReadOnly(BasePermission):
    """Staff can read; only superusers can write."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_staff):
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_superuser
