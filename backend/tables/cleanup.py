"""S23 cleanup of selected tables; never trust a browser's occupancy snapshot."""
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.admin.models import DELETION, LogEntry
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.db import transaction
from django.utils import timezone

from .models import PokerTable


def can_cleanup(user):
    return bool(
        user.is_authenticated
        and user.is_active
        and user.is_staff
        and user.has_perm("tables.delete_pokertable")
    )


def cleanup_minutes():
    minutes = settings.TABLE_CLEANUP_INACTIVITY_MINUTES
    if type(minutes) is not int or minutes <= 0:
        raise ImproperlyConfigured(
            "TABLE_CLEANUP_INACTIVITY_MINUTES must be a positive whole number."
        )
    return minutes


@dataclass(frozen=True)
class CleanupResult:
    deleted_ids: tuple[int, ...]
    skipped_count: int


@transaction.atomic
def cleanup_tables(*, actor, table_ids, now=None):
    """Delete eligible selected rows and audit them in the same transaction.

    Future seating/activity writers must lock the same PokerTable row and update
    occupancy/activity atomically. Waiting for their lock gives us current values.
    """
    if not can_cleanup(actor):
        raise PermissionDenied("Administrator table-delete permission is required.")
    cutoff = (now if now is not None else timezone.now()) - timedelta(
        minutes=cleanup_minutes()
    )
    selected_ids = set(table_ids)
    deleted_ids = []
    # Here we lock in a stable order, then check every condition on the locked row.
    tables = PokerTable.objects.filter(pk__in=selected_ids).order_by("pk").select_for_update()
    for table in tables:
        if not (
            table.is_public
            and table.player_count == 0
            and table.status in (PokerTable.Status.WAITING, PokerTable.Status.CLOSED)
            and table.last_activity_at < cutoff
        ):
            continue
        table_id = table.pk
        LogEntry.objects.log_actions(
            user_id=actor.pk,
            queryset=[table],
            action_flag=DELETION,
            change_message=(
                "S23 cleanup: empty public table; last activity before "
                f"{cutoff.isoformat()}."
            ),
        )
        table.delete()
        deleted_ids.append(table_id)
    return CleanupResult(tuple(deleted_ids), len(selected_ids) - len(deleted_ids))
