"""Trusted server-side result saves. There is deliberately no balance-write API.

Call inside the game engine's settlement transaction when settling multiple
players. The caller must derive each delta and stable source ID from the actual
game result, and distinguish account-wallet changes from chips reserved at a table.
"""
from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from django.db import transaction

from profiles.rewards import MAX_BALANCE
from .models import ChipResult


class InsufficientChips(ValueError):
    """The requested loss would make the account balance negative."""


class ChipBalanceLimit(ValueError):
    """The requested win would exceed the supported account balance."""


class ConflictingChipResult(ValueError):
    """A stable result ID was retried with a different chip change."""


@dataclass(frozen=True)
class SavedChipResult:
    """Return the current balance, including on a retry after other chip writes."""

    result_id: int
    chip_balance: int
    applied: bool


@transaction.atomic
def save_chip_result(user_id, *, source, delta):
    """Persist one authoritative signed chip change exactly once for an account.

    Positive deltas add chips, negative deltas deduct chips, and zero records a
    no-change result. Identical retries return the current balance without
    reapplying the result. An altered retry is rejected without changing anything.
    """
    if type(user_id) is not int or user_id <= 0:
        raise ValueError("A registered account ID is required.")
    if (
        not isinstance(source, str)
        or not source
        or source != source.strip()
        or len(source) > 100
    ):
        raise ValueError("Supply a stable result ID of 1-100 characters without surrounding spaces.")
    if type(delta) is not int or not -MAX_BALANCE <= delta <= MAX_BALANCE:
        raise ValueError("The chip change must be a supported whole number.")

    # Rewards already lock this same row, so concurrent rewards and results do
    # not overwrite each other's balances.
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.is_active or getattr(user, "is_guest", False):
        raise PermissionDenied("Chip results require an active registered account.")

    previous = ChipResult.objects.filter(user=user, source=source).first()
    if previous is not None:
        if previous.delta != delta:
            raise ConflictingChipResult("A saved chip result cannot be rewritten.")
        return SavedChipResult(previous.pk, user.chip_balance, False)

    balance = user.chip_balance + delta
    if balance < 0:
        raise InsufficientChips("The result would make the chip balance negative.")
    if balance > MAX_BALANCE:
        raise ChipBalanceLimit("The result would exceed the chip balance limit.")

    user.chip_balance = balance
    user.save(update_fields=["chip_balance"])
    receipt = ChipResult.objects.create(
        user=user, source=source, delta=delta, balance_after=balance,
    )
    return SavedChipResult(receipt.pk, balance, True)
