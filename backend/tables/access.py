"""Shared visibility policy for private table details, seating and spectators."""
from django.db.models import Q
from django.http import Http404

from .models import PokerTable, TableInvitation


def visible_tables(user):
    """List public tables plus private tables explicitly accessible to an active account."""
    condition = Q(is_public=True)
    if user.is_authenticated and user.is_active and not getattr(user, "is_guest", False):
        condition |= Q(host=user) | Q(invitations__user=user)
    return PokerTable.objects.filter(condition).distinct()


def require_table_access(table, user):
    """Hide private table existence from accounts without a host-issued invitation."""
    if table.is_public:
        return
    if (user.is_active and user.is_authenticated and not getattr(user, "is_guest", False)
            and (table.host_id == user.pk or TableInvitation.objects.filter(table=table, user=user).exists())):
        return
    raise Http404
