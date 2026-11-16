"""Fund table seats and enforce in-hand cash-out rules under row locks."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from profiles.rewards import MAX_BALANCE
from .models import HandParticipant, PokerHand, PokerTable, TableSeat
from .access import require_table_access
from .live_updates import queue_game_update


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
    can_leave = seat is None or table.status != PokerTable.Status.PLAYING
    if not can_leave:
        hand = PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).first()
        participant = (
            HandParticipant.objects.filter(hand=hand, user=user).first()
            if hand
            else None
        )
        can_leave = participant is None or participant.folded
    return {
        "table_id": table.pk, "player_count": table.player_count,
        "table_status": table.status,
        "chip_balance": user.chip_balance,
        "seat": {"id": seat.pk, "buy_in": seat.buy_in, "stack": seat.stack} if seat else None,
        "can_leave": can_leave,
    }


@transaction.atomic
def join_table(table_id, user_id):
    """Recheck affordability and capacity, then reserve chips for the next hand."""
    table, user = _locked_records(table_id, user_id)
    seat = TableSeat.objects.filter(user=user).first()
    if seat:
        if seat.table_id != table.pk:
            raise SeatingConflict("Leave your current table before joining another.")
        return _payload(table, user, seat)
    if table.status == PokerTable.Status.CLOSED:
        raise SeatingConflict("This table is closed.")
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
    if table.status == PokerTable.Status.WAITING:
        from .gameplay import start_hand_if_ready

        start_hand_if_ready(table)
    queue_game_update(table.pk)
    return _payload(table, user, seat)


@transaction.atomic
def leave_table(table_id, user_id):
    """Return the held stack once. Never permit a player to cash out mid-hand."""
    table, user = _locked_records(table_id, user_id)
    seat = TableSeat.objects.filter(user=user, table=table).first()
    if not seat:
        return _payload(table, user, None)
    if table.status == PokerTable.Status.PLAYING:
        hand = PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).first()
        participant = (
            HandParticipant.objects.select_for_update()
            .filter(hand=hand, user=user)
            .first()
            if hand
            else None
        )
        if participant is not None and not participant.folded:
            raise SeatingConflict("Finish or fold your hand before leaving this table.")
        if hand and participant:
            participant.seat = None
            participant.save(update_fields=["seat"])
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
    queue_game_update(table.pk)
    return _payload(table, user, None)
