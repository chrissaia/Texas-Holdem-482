from rest_framework.permissions import BasePermission


def can_host(request):
    """Finn's guests must be anonymous or carry an explicit is_guest marker."""
    user = request.user
    return bool(
        user.is_authenticated
        and user.is_active
        and not getattr(user, "is_guest", False)
        and not request.session.get("is_guest", False)
    )


class CanHostTable(BasePermission):
    message = "Sign in with a registered account to create a table."

    def has_permission(self, request, view):
        return can_host(request)
