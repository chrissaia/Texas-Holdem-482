"""S16 acceptance-focused tests against real PostgreSQL and account APIs."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.core.exceptions import PermissionDenied
from django.test import Client
from django.urls import reverse
from rest_framework.test import APIClient

from chips.models import ChipResult
from chips.services import (
    ChipBalanceLimit, ConflictingChipResult, InsufficientChips, save_chip_result,
)
from profiles.rewards import (
    MAX_BALANCE, claim_daily_chips, grant_starting_chips,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def funded_user(registered_user):
    """Use the existing real starting-chip service rather than a second grant implementation."""
    return grant_starting_chips(registered_user.pk)


@pytest.mark.parametrize("delta,expected", [(250, 1250), (-150, 850), (0, 1000), (-1000, 0)])
def test_signed_results_persist_balance_and_receipt(funded_user, delta, expected):
    saved = save_chip_result(funded_user.pk, source="hand:1", delta=delta)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == saved.chip_balance == expected
    assert saved.applied is True
    receipt = ChipResult.objects.get(pk=saved.result_id)
    assert receipt.user_id == funded_user.pk
    assert receipt.delta == delta
    assert receipt.balance_after == expected
    assert receipt.source == "hand:1"
    assert receipt.created_at is not None
    assert funded_user.starting_chips_granted_at is not None


def test_distinct_results_accumulate_instead_of_overwriting(funded_user):
    save_chip_result(funded_user.pk, source="hand:1", delta=300)
    save_chip_result(funded_user.pk, source="hand:2", delta=-125)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1175
    assert ChipResult.objects.filter(user=funded_user).count() == 2


def test_identical_retry_is_not_paid_again_and_returns_current_balance(funded_user):
    original = save_chip_result(funded_user.pk, source="hand:1", delta=100)
    claim_daily_chips(funded_user.pk)
    repeated = save_chip_result(funded_user.pk, source="hand:1", delta=100)
    assert repeated.result_id == original.result_id
    assert repeated.applied is False
    assert repeated.chip_balance == 1600
    assert ChipResult.objects.get().balance_after == 1100
    assert ChipResult.objects.count() == 1


@pytest.mark.parametrize("different_delta", [-100, 0, 101])
def test_conflicting_retry_cannot_rewrite_a_saved_result(funded_user, different_delta):
    save_chip_result(funded_user.pk, source="hand:1", delta=100)
    with pytest.raises(ConflictingChipResult):
        save_chip_result(funded_user.pk, source="hand:1", delta=different_delta)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1100
    assert ChipResult.objects.get().delta == 100


@pytest.mark.parametrize("delta", [True, False, 1.5, "100", None, MAX_BALANCE + 1, -MAX_BALANCE - 1])
def test_invalid_chip_changes_leave_balance_and_receipts_untouched(funded_user, delta):
    with pytest.raises(ValueError):
        save_chip_result(funded_user.pk, source="invalid", delta=delta)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1000
    assert not ChipResult.objects.exists()


@pytest.mark.parametrize("source", ["", " ", " hand:1", "hand:1 ", "x" * 101, None, 123])
def test_invalid_source_ids_are_rejected(funded_user, source):
    with pytest.raises(ValueError):
        save_chip_result(funded_user.pk, source=source, delta=1)
    assert not ChipResult.objects.exists()


@pytest.mark.parametrize("user_id", [None, 0, -1, True, "1"])
def test_registered_integer_account_id_is_required(user_id):
    with pytest.raises(ValueError):
        save_chip_result(user_id, source="hand:1", delta=1)
    assert not ChipResult.objects.exists()


def test_unknown_account_is_not_created_or_paid():
    with pytest.raises(get_user_model().DoesNotExist):
        save_chip_result(987654321, source="hand:1", delta=1)
    assert not ChipResult.objects.exists()


def test_inactive_account_cannot_receive_a_result(funded_user):
    funded_user.is_active = False
    funded_user.save(update_fields=["is_active"])
    with pytest.raises(PermissionDenied):
        save_chip_result(funded_user.pk, source="hand:1", delta=100)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1000
    assert not ChipResult.objects.exists()


def test_guest_user_marker_is_denied(funded_user, monkeypatch):
    monkeypatch.setattr(get_user_model(), "is_guest", True, raising=False)
    with pytest.raises(PermissionDenied):
        save_chip_result(funded_user.pk, source="hand:1", delta=100)
    assert not ChipResult.objects.exists()


@pytest.mark.parametrize("balance,delta,error", [
    (1000, -1001, InsufficientChips),
    (MAX_BALANCE, 1, ChipBalanceLimit),
])
def test_underflow_and_overflow_roll_back(funded_user, balance, delta, error):
    get_user_model().objects.filter(pk=funded_user.pk).update(chip_balance=balance)
    with pytest.raises(error):
        save_chip_result(funded_user.pk, source="hand:1", delta=delta)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == balance
    assert not ChipResult.objects.exists()


def test_exact_upper_boundary_and_longest_source_are_supported(funded_user):
    saved = save_chip_result(
        funded_user.pk, source="x" * 100, delta=MAX_BALANCE - 1000,
    )
    assert saved.chip_balance == MAX_BALANCE


def test_same_source_can_record_different_players_without_cross_account_changes(funded_user):
    other = get_user_model().objects.create_user(username="other-player")
    grant_starting_chips(other.pk)
    save_chip_result(funded_user.pk, source="hand:1", delta=100)
    save_chip_result(other.pk, source="hand:1", delta=-100)
    funded_user.refresh_from_db()
    other.refresh_from_db()
    assert (funded_user.chip_balance, other.chip_balance) == (1100, 900)


def test_receipt_failure_rolls_back_balance_update(funded_user, monkeypatch):
    def fail_receipt(**kwargs):
        raise RuntimeError("simulated receipt storage failure")

    monkeypatch.setattr(ChipResult.objects, "create", fail_receipt)
    with pytest.raises(RuntimeError):
        save_chip_result(funded_user.pk, source="hand:1", delta=100)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1000
    assert not ChipResult.objects.exists()


def test_outer_settlement_transaction_rolls_back_every_player(funded_user):
    other = get_user_model().objects.create_user(username="opponent")
    with pytest.raises(InsufficientChips):
        with transaction.atomic():
            save_chip_result(funded_user.pk, source="hand:1", delta=100)
            save_chip_result(other.pk, source="hand:1", delta=-100)
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1000
    assert not ChipResult.objects.exists()


def test_database_prevents_duplicate_receipts(funded_user):
    save_chip_result(funded_user.pk, source="hand:1", delta=100)
    with pytest.raises(IntegrityError), transaction.atomic():
        ChipResult.objects.create(
            user=funded_user, source="hand:1", delta=100, balance_after=1100,
        )


@pytest.mark.parametrize("field,value", [
    ("delta", MAX_BALANCE + 1),
    ("delta", -MAX_BALANCE - 1),
    ("balance_after", -1),
    ("balance_after", MAX_BALANCE + 1),
])
def test_database_bounds_protect_receipts(funded_user, field, value):
    data = {"user": funded_user, "source": "bad-db-result", "delta": 0, "balance_after": 1000}
    data[field] = value
    with pytest.raises(IntegrityError), transaction.atomic():
        ChipResult.objects.create(**data)


def test_saved_balance_survives_logout_and_new_login(funded_user, registered_client):
    saved = save_chip_result(funded_user.pk, source="hand:1", delta=250)
    before = registered_client.get(reverse("profiles:profile"))
    assert before.status_code == 200
    assert before.data["chip_balance"] == saved.chip_balance == 1250
    assert "no-store" in before["Cache-Control"]
    assert registered_client.post(reverse("accounts:logout"), {}, format="json").status_code == 200
    fresh = APIClient(enforce_csrf_checks=True)
    token = fresh.get(reverse("accounts:session")).data["csrf_token"]
    response = fresh.post(
        reverse("accounts:login"),
        {"username": funded_user.username, "password": "river-card-482"},
        format="json", HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 200
    assert fresh.get(reverse("profiles:profile")).data["chip_balance"] == 1250


def test_browsers_cannot_submit_balance_or_game_results(funded_user, registered_client, guest_client):
    payload = {"chip_balance": 999999, "user_id": funded_user.pk, "delta": 100, "source": "fake-hand"}
    assert registered_client.post(reverse("profiles:profile"), payload, format="json").status_code == 405
    assert registered_client.post(reverse("profiles:daily"), payload, format="json").status_code == 400
    assert guest_client.get(reverse("profiles:profile")).status_code == 403
    assert APIClient().get(reverse("profiles:profile")).status_code == 403
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1000
    assert not ChipResult.objects.exists()


def test_receipts_are_read_only_in_admin(funded_user, rivr_admin):
    saved = save_chip_result(funded_user.pk, source="hand:1", delta=100)
    client = Client()
    client.force_login(rivr_admin)
    assert client.get(reverse("admin:chips_chipresult_changelist")).status_code == 200
    detail = reverse("admin:chips_chipresult_change", args=[saved.result_id])
    assert client.get(detail).status_code == 200
    assert client.post(detail, {"delta": 999}).status_code == 403
    assert client.get(reverse("admin:chips_chipresult_add")).status_code == 403
    assert client.post(reverse("admin:chips_chipresult_delete", args=[saved.result_id])).status_code == 403
    model_admin = admin.site._registry[ChipResult]
    assert not model_admin.get_actions(client.get(detail).wsgi_request)
    receipt = ChipResult.objects.get()
    assert receipt.delta == 100
    funded_user.refresh_from_db()
    assert funded_user.chip_balance == 1100


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("scenario,expected_balance,expected_receipts", [
    ("same_result", 1250, 1),
    ("different_results", 1500, 2),
    ("with_reward", 1750, 1),
    ("competing_losses", 250, 1),
])
def test_concurrent_result_and_reward_writes_do_not_double_pay_or_lose_updates(
    scenario, expected_balance, expected_receipts,
):
    assert connection.vendor == "postgresql"
    user = get_user_model().objects.create_user(username="concurrent-chip-player")
    grant_starting_chips(user.pk)
    barrier = Barrier(2)

    def worker(index):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            if scenario == "with_reward" and index == 1:
                return claim_daily_chips(user.pk).chip_balance
            source = "hand:1" if scenario in ("same_result", "competing_losses") else f"hand:{index}"
            if scenario == "competing_losses":
                source = f"hand:{index}"
            try:
                return save_chip_result(
                    user.pk, source=source,
                    delta=-750 if scenario == "competing_losses" else 250,
                ).applied
            except InsufficientChips:
                return "insufficient"
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker, index) for index in range(2)]
        results = [future.result(timeout=20) for future in futures]
    user.refresh_from_db()
    assert user.chip_balance == expected_balance
    assert ChipResult.objects.count() == expected_receipts
    if scenario == "same_result":
        assert sorted(results) == [False, True]
    elif scenario == "competing_losses":
        assert results.count("insufficient") == 1
