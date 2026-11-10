"""Fund public waiting-table seats under table-then-account locks."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from profiles.rewards import MAX_BALANCE
from .models import PokerTable, TableSeat
from .access import require_table_access


class SeatingConflict(APIException):
    status_code = 409
    default_detail = "The seat could not be changed. Refresh and try again."


def _locked_records(table_id, user_id):
    table = get_object_or_404(PokerTable.objects.select_for_update(), pk=table_id)
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.is_active or getattr(user, "is_guest", False):
        raise PermissionDenied("Sign in with an active registered account to join.")
    require_table_access(table, user)
    return table, user


def _payload(table, user, seat):
    return {
        "table_id": table.pk, "player_count": table.player_count,
        "chip_balance": user.chip_balance,
        "seat": {"id": seat.pk, "buy_in": seat.buy_in, "stack": seat.stack} if seat else None,
    }


@transaction.atomic
def join_table(table_id, user_id):
    """Recheck affordability and capacity, then reserve chips exactly once."""
    table, user = _locked_records(table_id, user_id)
    seat = TableSeat.objects.filter(user=user).first()
    if seat:
        if seat.table_id != table.pk:
            raise SeatingConflict("Leave your current table before joining another.")
        return _payload(table, user, seat)
    if table.status != PokerTable.Status.WAITING:
        raise SeatingConflict("This table is not accepting players right now.")
    if table.player_count >= table.max_players:
        raise SeatingConflict("This table is full.")
    required = max(table.buy_in, table.minimum_balance)
    if user.chip_balance < required:
        raise SeatingConflict(f"You need at least {required:,} chips to join this table.")
    user.chip_balance -= table.buy_in
    user.save(update_fields=["chip_balance"])
    seat = TableSeat.objects.create(user=user, table=table, buy_in=table.buy_in, stack=table.buy_in)
    table.player_count += 1
    table.last_activity_at = timezone.now()
    table.save(update_fields=["player_count", "last_activity_at"])
    return _payload(table, user, seat)


@transaction.atomic
def leave_table(table_id, user_id):
    """Return the held stack once. Never permit a player to cash out mid-hand."""
    table, user = _locked_records(table_id, user_id)
    seat = TableSeat.objects.filter(user=user, table=table).first()
    if not seat:
        return _payload(table, user, None)
    if table.status == PokerTable.Status.PLAYING:
        raise SeatingConflict("Wait for play to finish before leaving this table.")
    if user.chip_balance + seat.stack > MAX_BALANCE:
        raise SeatingConflict("Your wallet is at its limit. Your table chips remain reserved.")
    if table.player_count < 1:
        raise SeatingConflict("Table occupancy needs an administrator's attention.")
    user.chip_balance += seat.stack
    user.save(update_fields=["chip_balance"])
    seat.delete()
    table.player_count -= 1
    table.last_activity_at = timezone.now()
    table.save(update_fields=["player_count", "last_activity_at"])
    return _payload(table, user, None)
