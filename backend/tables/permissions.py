"""Authorization rules used by table endpoints for public poker-table configuration and browsing."""

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
    """Require an active registered session before allowing table creation."""
    message = "Sign in with a registered account to create a table."

    def has_permission(self, request, view):
        """Decide whether the requesting session satisfies this endpoint's access policy."""
        return can_host(request)
