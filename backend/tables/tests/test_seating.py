"""S15 API, accounting, authorization, and PostgreSQL concurrency checks."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from chips.services import save_chip_result
from profiles.rewards import MAX_BALANCE, grant_starting_chips
from tables.cleanup import cleanup_tables
from tables.models import PokerTable, TableSeat
from tables.seating import SeatingConflict, join_table, leave_table

pytestmark = pytest.mark.django_db


def make_table(host, **kwargs):
    values = dict(name="Buy-in test", host=host, max_players=2, buy_in=100,
                  minimum_balance=200, small_blind=5, big_blind=10)
    return PokerTable.objects.create(**(values | kwargs))


@pytest.fixture
def table(registered_user):
    grant_starting_chips(registered_user.pk)
    return make_table(registered_user)


def url(table):
    return reverse("tables:seat", args=[table.pk])


def test_join_debits_once_and_leave_refunds_once(table, registered_client, registered_user):
    before = table.last_activity_at
    for _ in range(2):
        response = registered_client.post(url(table), {}, format="json")
        assert response.status_code == 200
        assert response.data["chip_balance"] == 900
        assert response.data["seat"]["stack"] == 100
        assert response.data["player_count"] == 1
    assert TableSeat.objects.count() == 1
    table.refresh_from_db()
    assert table.last_activity_at >= before
    status = registered_client.get(url(table))
    assert status.data["seat"]["buy_in"] == 100
    assert status.data["csrf_token"]
    assert "no-store" in status["Cache-Control"]
    for _ in range(2):
        response = registered_client.delete(url(table), {}, format="json")
        assert response.status_code == 200
        assert response.data["chip_balance"] == 1000
        assert response.data["seat"] is None
    table.refresh_from_db()
    registered_user.refresh_from_db()
    assert table.player_count == 0
    assert registered_user.chip_balance == 1000
    assert not TableSeat.objects.exists()


@pytest.mark.parametrize("balance,allowed", [(0, False), (99, False), (100, False), (199, False), (200, True)])
def test_minimum_balance_checked_against_saved_wallet(table, registered_user, registered_client, balance, allowed):
    get_user_model().objects.filter(pk=registered_user.pk).update(chip_balance=balance)
    result = registered_client.post(url(table), {}, format="json")
    assert result.status_code == (200 if allowed else 409)
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == balance - (100 if allowed else 0)
    assert TableSeat.objects.exists() == allowed


def test_later_loss_invalidates_previously_affordable_screen(table, registered_user, registered_client):
    assert registered_client.get(url(table)).data["chip_balance"] == 1000
    save_chip_result(registered_user.pk, source="test-real-server-loss", delta=-900)
    assert registered_client.post(url(table), {}, format="json").status_code == 409
    assert not TableSeat.objects.exists()


@pytest.mark.parametrize("fields", [{"status": "playing"}, {"status": "closed"}, {"player_count": 2}])
def test_unavailable_table_does_not_take_chips(table, registered_user, fields):
    PokerTable.objects.filter(pk=table.pk).update(**fields)
    with pytest.raises(SeatingConflict):
        join_table(table.pk, registered_user.pk)
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == 1000
    assert not TableSeat.objects.exists()


@pytest.mark.parametrize("method", ["get", "post", "delete"])
def test_guests_and_anonymous_cannot_access_seats(table, guest_client, method):
    for client in (APIClient(), guest_client):
        result = getattr(client, method)(url(table), {}, format="json")
        assert result.status_code == 403


@pytest.mark.parametrize("method", ["post", "delete"])
def test_writes_require_csrf(table, registered_user, method):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(registered_user)
    assert getattr(client, method)(url(table), {}, format="json").status_code == 403


@pytest.mark.parametrize("payload", [{"user_id": 1}, {"buy_in": 0}, {"stack": 99999}, [], {"chip_balance": 99999}])
def test_client_cannot_choose_account_buy_in_or_balance(table, registered_client, payload):
    assert registered_client.post(url(table), payload, format="json").status_code == 400
    assert not TableSeat.objects.exists()


def test_uninvited_private_and_unknown_tables_not_exposed(table, registered_client):
    table.host = get_user_model().objects.create_user(username="different-private-host")
    table.is_public = False
    table.save()
    assert registered_client.get(url(table)).status_code == 404
    assert registered_client.post(url(table), {}, format="json").status_code == 404
    assert registered_client.get(reverse("tables:seat", args=[987654])).status_code == 404


def test_other_table_requires_leaving_first(table, registered_user, registered_client):
    join_table(table.pk, registered_user.pk)
    other = make_table(registered_user)
    assert registered_client.get(url(other)).data["other_table_id"] == table.pk
    assert registered_client.post(url(other), {}, format="json").status_code == 409
    leave_table(other.pk, registered_user.pk)
    assert TableSeat.objects.get().table_id == table.pk


def test_no_other_account_seat_or_wallet_exposed(table, registered_client):
    other = get_user_model().objects.create_user(username="other-seat-player", chip_balance=500)
    join_table(table.pk, other.pk)
    result = registered_client.get(url(table))
    assert result.data["seat"] is None
    assert result.data["chip_balance"] == 1000
    registered_client.delete(url(table), {}, format="json")
    assert TableSeat.objects.get().user_id == other.pk


def test_failed_seat_creation_rolls_back_wallet(table, registered_user, monkeypatch):
    def fail(**kwargs):
        raise RuntimeError("storage failure")
    monkeypatch.setattr(TableSeat.objects, "create", fail)
    with pytest.raises(RuntimeError):
        join_table(table.pk, registered_user.pk)
    registered_user.refresh_from_db()
    table.refresh_from_db()
    assert registered_user.chip_balance == 1000
    assert table.player_count == 0


@pytest.mark.parametrize("change", ["playing", "limit", "occupancy"])
def test_unsafe_leave_keeps_reserved_chips(table, registered_user, change):
    join_table(table.pk, registered_user.pk)
    if change == "playing":
        PokerTable.objects.filter(pk=table.pk).update(status="playing")
    elif change == "limit":
        get_user_model().objects.filter(pk=registered_user.pk).update(chip_balance=MAX_BALANCE)
    else:
        PokerTable.objects.filter(pk=table.pk).update(player_count=0)
    with pytest.raises(SeatingConflict):
        leave_table(table.pk, registered_user.pk)
    assert TableSeat.objects.get().stack == 100


def test_closed_table_can_return_reserved_chips(table, registered_user):
    join_table(table.pk, registered_user.pk)
    PokerTable.objects.filter(pk=table.pk).update(status="closed")
    assert leave_table(table.pk, registered_user.pk)["chip_balance"] == 1000


def test_inactive_user_cannot_join_even_via_service(table, registered_user):
    from rest_framework.exceptions import PermissionDenied
    get_user_model().objects.filter(pk=registered_user.pk).update(is_active=False)
    with pytest.raises(PermissionDenied):
        join_table(table.pk, registered_user.pk)


def test_cleanup_skips_funded_seat(table, registered_user, rivr_admin):
    join_table(table.pk, registered_user.pk)
    PokerTable.objects.filter(pk=table.pk).update(last_activity_at=timezone.now()-timedelta(hours=2))
    result = cleanup_tables(actor=rivr_admin, table_ids=[table.pk])
    assert result.deleted_ids == ()
    assert TableSeat.objects.exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("scenario", ["same_join", "last_seat", "two_tables", "same_leave"])
def test_concurrent_seating_preserves_money_and_capacity(scenario):
    assert connection.vendor == "postgresql"
    User = get_user_model()
    users = [User.objects.create_user(username=f"seat-race-{i}", chip_balance=1000) for i in range(2)]
    table = make_table(users[0], player_count=1 if scenario == "last_seat" else 0)
    other = make_table(users[0])
    if scenario == "same_leave":
        join_table(table.pk, users[0].pk)
    barrier = Barrier(2)
    def work(i):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            target = other.pk if scenario == "two_tables" and i else table.pk
            user_id = users[i].pk if scenario == "last_seat" else users[0].pk
            action = leave_table if scenario == "same_leave" else join_table
            try:
                action(target, user_id)
                return True
            except SeatingConflict:
                return False
        finally:
            connection.close()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(work, i) for i in range(2)]
        results = [f.result(timeout=20) for f in futures]
    for user in users:
        user.refresh_from_db()
    assert sum(u.chip_balance for u in users) + sum(TableSeat.objects.values_list("stack", flat=True)) == 2000
    assert TableSeat.objects.count() == (0 if scenario == "same_leave" else 1)
    if scenario in ("two_tables", "last_seat"):
        assert results.count(True) == 1
    table.refresh_from_db()
    assert table.player_count <= table.max_players


def test_funded_table_cannot_be_hidden_by_admin(table, registered_user, rivr_admin):
    from django.contrib import admin
    from django.test import RequestFactory
    request = RequestFactory().get("/admin/")
    request.user = rivr_admin
    model_admin = admin.site._registry[PokerTable]
    assert "is_public" not in model_admin.get_readonly_fields(request, table)
    join_table(table.pk, registered_user.pk)
    assert "is_public" in model_admin.get_readonly_fields(request, table)


def test_failed_leave_rolls_back_refund(table, registered_user, monkeypatch):
    join_table(table.pk, registered_user.pk)
    def fail(self, *args, **kwargs):
        raise RuntimeError("delete failure")
    monkeypatch.setattr(TableSeat, "delete", fail)
    with pytest.raises(RuntimeError):
        leave_table(table.pk, registered_user.pk)
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == 900
    assert TableSeat.objects.get().stack == 100


def test_cleanup_skips_reserved_chips_even_if_legacy_count_is_wrong(table, registered_user, rivr_admin):
    join_table(table.pk, registered_user.pk)
    PokerTable.objects.filter(pk=table.pk).update(player_count=0, last_activity_at=timezone.now()-timedelta(hours=2))
    assert cleanup_tables(actor=rivr_admin, table_ids=[table.pk]).deleted_ids == ()
    assert TableSeat.objects.exists()
