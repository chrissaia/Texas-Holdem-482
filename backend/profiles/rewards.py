"""Server-owned chip grants, serialized on the account row."""
from datetime import datetime, timedelta, timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

STARTING_CHIPS = 1000
DAILY_CHIPS = 500
MAX_BALANCE = 9_007_199_254_740_991
UTC = dt_timezone.utc


class AlreadyClaimed(Exception):
    pass


class BalanceLimit(Exception):
    pass


def reward_status(user, now=None):
    now = (now or timezone.now()).astimezone(UTC)
    last = user.daily_chips_claimed_at
    eligible = last is None or last.astimezone(UTC).date() < now.date()
    next_claim = None
    if not eligible:
        next_claim = datetime.combine(last.astimezone(UTC).date() + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
    return {"amount": DAILY_CHIPS, "available": eligible, "next_claim_at": next_claim}


@transaction.atomic
def grant_starting_chips(user_id):
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if user.starting_chips_granted_at is None:
        if user.chip_balance > MAX_BALANCE - STARTING_CHIPS:
            raise BalanceLimit
        user.chip_balance += STARTING_CHIPS
        user.starting_chips_granted_at = timezone.now()
        user.save(update_fields=["chip_balance", "starting_chips_granted_at"])
    return user


@transaction.atomic
def claim_daily_chips(user_id):
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    now = timezone.now()
    if not reward_status(user, now)["available"]:
        raise AlreadyClaimed
    if user.chip_balance > MAX_BALANCE - DAILY_CHIPS:
        raise BalanceLimit
    user.chip_balance += DAILY_CHIPS
    user.daily_chips_claimed_at = now
    user.save(update_fields=["chip_balance", "daily_chips_claimed_at"])
    return user
