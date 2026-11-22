"""Exercise S28 through real sessions, CSRF and PostgreSQL transactions."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission
from django.db import close_old_connections
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from core.moderation import TableActionView, UserActionView
from tables.models import PokerTable, TableSeat
from tables.seating import join_table

pytestmark = pytest.mark.django_db
BASE = "/api/moderation/"


@pytest.fixture
def table(registered_user):
    return PokerTable.objects.create(name="Moderation table", host=registered_user,
        max_players=6, buy_in=100, minimum_balance=100, small_blind=5, big_blind=10)


def change(client, path, action, expected, reason="Investigated report"):
    return client.post(BASE + path, {"action": action, "expected": expected, "reason": reason}, format="json")


@pytest.mark.parametrize("path", ["", "users/", "tables/", "audit/"])
def test_private_reads_deny_non_staff(path, registered_client, guest_client):
    for client in [APIClient(), registered_client, guest_client]:
        response = client.get(BASE + path)
        assert response.status_code == 403
        assert "no-store" in response["Cache-Control"]


def test_context_permissions_and_minimal_user_fields(rivr_admin_client, registered_user):
    response = rivr_admin_client.get(BASE)
    assert response.data["csrf_token"]
    assert response.data["can_view_audit"]
    response = rivr_admin_client.get(BASE + "users/?q=registered")
    assert response.data["count"] == 1
    assert set(response.data["results"][0]) == {"id", "username", "is_active", "is_admin", "date_joined"}


def test_navigation_flag_is_only_for_current_staff_viewer(rivr_admin_client, registered_client):
    path = "/api/tables/creation-context/"
    assert rivr_admin_client.get(path).data["is_admin"] is True
    assert registered_client.get(path).data["is_admin"] is False
    assert APIClient().get(path).data["is_admin"] is False


def test_staff_needs_model_permissions(rivr_admin_client, rivr_admin):
    rivr_admin.is_superuser = False
    rivr_admin.save()
    assert not rivr_admin_client.get(BASE).data["can_view_users"]
    for path in ["users/", "tables/", "audit/"]:
        assert rivr_admin_client.get(BASE + path).status_code == 403
    rivr_admin.user_permissions.add(Permission.objects.get(codename="view_user", content_type__app_label="accounts"))
    assert rivr_admin_client.get(BASE + "users/").status_code == 200
    assert change(rivr_admin_client, "users/99/action/", "suspend", "active").status_code == 403


@pytest.mark.parametrize("query", ["page=0", "page=x", "q=" + "a" * 81, "q=a&q=b", "bad=x", "state=playing"])
def test_invalid_queries_rejected(rivr_admin_client, query):
    assert rivr_admin_client.get(BASE + "users/?" + query).status_code == 400


def test_search_filter_pagination_and_private_tables(rivr_admin_client, table):
    table.is_public = False
    table.save()
    result = rivr_admin_client.get(BASE + "tables/?q=MODERATION&state=waiting").data
    assert result["count"] == 1 and not result["results"][0]["is_public"]
    assert rivr_admin_client.get(BASE + "tables/?page=2").data["results"] == []
    assert rivr_admin_client.get(BASE + "users/?state=suspended").data["count"] == 0
    assert rivr_admin_client.get(BASE + "tables/?state=active").status_code == 400


def test_suspend_blocks_existing_session_and_login_then_reactivate(rivr_admin_client, registered_client, registered_user):
    path = f"users/{registered_user.pk}/action/"
    original_balance = registered_user.chip_balance
    assert change(rivr_admin_client, path, "suspend", "active").status_code == 200
    registered_user.refresh_from_db()
    assert not registered_user.is_active and registered_user.chip_balance == original_balance
    assert registered_client.get("/api/profile/").status_code == 403
    response = registered_client.post("/api/auth/login/", {"username": registered_user.username, "password": "river-card-482"}, format="json")
    assert response.status_code == 400
    assert change(rivr_admin_client, path, "reactivate", "suspended").status_code == 200
    registered_user.refresh_from_db()
    assert registered_user.is_active
    logs = rivr_admin_client.get(BASE + "audit/").data["results"]
    assert [item["action"] for item in logs] == ["reactivate", "suspend"]
    assert logs[0]["reason"] == "Investigated report"
    assert logs[0]["actor"] == "rivr-admin"


def test_self_and_staff_targets_protected(rivr_admin_client, rivr_admin):
    staff = User.objects.create_user(username="other-admin", is_staff=True)
    for target in [rivr_admin, staff]:
        assert change(rivr_admin_client, f"users/{target.pk}/action/", "suspend", "active").status_code == 409
    assert not LogEntry.objects.exists()


def test_seated_player_cannot_be_suspended(rivr_admin_client, registered_user, table):
    TableSeat.objects.create(user=registered_user, table=table, buy_in=100, stack=100)
    response = change(rivr_admin_client, f"users/{registered_user.pk}/action/", "suspend", "active")
    assert response.status_code == 409
    assert "reserved" in response.data["detail"]
    registered_user.refresh_from_db()
    assert registered_user.is_active


def test_table_close_reopen_preserves_records_and_audits(rivr_admin_client, table):
    path = f"tables/{table.pk}/action/"
    assert change(rivr_admin_client, path, "close", "waiting").status_code == 200
    table.refresh_from_db()
    assert table.status == "closed"
    assert change(rivr_admin_client, path, "reopen", "closed").status_code == 200
    table.refresh_from_db()
    assert table.status == "waiting"
    assert LogEntry.objects.count() == 2
    assert rivr_admin_client.get(BASE + "audit/?q=Moderation").data["count"] == 2


@pytest.mark.parametrize("occupied", ["counter", "seat", "playing"])
def test_occupied_or_playing_table_is_protected(occupied, rivr_admin_client, table, registered_user):
    if occupied == "counter":
        table.player_count = 1
    elif occupied == "playing":
        table.status = "playing"
    else:
        TableSeat.objects.create(user=registered_user, table=table, buy_in=100, stack=100)
    table.save()
    response = change(rivr_admin_client, f"tables/{table.pk}/action/", "close", table.status)
    assert response.status_code == 409
    assert not LogEntry.objects.exists()


def test_stale_or_repeat_changes_do_not_duplicate_audit(rivr_admin_client, table):
    path = f"tables/{table.pk}/action/"
    assert change(rivr_admin_client, path, "close", "waiting").status_code == 200
    assert change(rivr_admin_client, path, "close", "waiting").status_code == 409
    assert change(rivr_admin_client, path, "close", "closed").status_code == 409
    assert LogEntry.objects.count() == 1


@pytest.mark.parametrize("payload", [{}, {"action": "suspend"}, [],
    {"action": "suspend", "expected": "active", "reason": " "},
    {"action": "suspend", "expected": "active", "reason": "ok!", "is_staff": True}])
def test_invalid_writes_rejected(payload, rivr_admin_client, registered_user):
    assert rivr_admin_client.post(BASE + f"users/{registered_user.pk}/action/", payload, format="json").status_code == 400
    assert not LogEntry.objects.exists()


def test_unknown_actions_ids_methods_and_csrf(rivr_admin_client, registered_user, table):
    user_path = f"users/{registered_user.pk}/action/"
    assert change(rivr_admin_client, user_path, "promote", "active").status_code == 400
    assert change(rivr_admin_client, f"tables/{table.pk}/action/", "delete", "waiting").status_code == 400
    assert change(rivr_admin_client, "users/999999/action/", "suspend", "active").status_code == 404
    assert change(rivr_admin_client, user_path + "?x=1", "suspend", "active").status_code == 400
    assert rivr_admin_client.get(BASE + user_path).status_code == 405
    rivr_admin_client.credentials()
    assert change(rivr_admin_client, user_path, "suspend", "active").status_code == 403


@pytest.mark.parametrize("kind", ["user", "table"])
def test_audit_failure_rolls_back_state(kind, rivr_admin_client, registered_user, table):
    path, action, before = (f"users/{registered_user.pk}/action/", "suspend", "active") if kind == "user" else (f"tables/{table.pk}/action/", "close", "waiting")
    with patch("core.moderation.audit", side_effect=RuntimeError("audit unavailable")):
        with pytest.raises(RuntimeError):
            change(rivr_admin_client, path, action, before)
    registered_user.refresh_from_db(); table.refresh_from_db()
    assert registered_user.is_active and table.status == "waiting"


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("moderate", ["close", "suspend"])
def test_join_and_moderation_cannot_strand_reserved_chips(moderate):
    """Seating and moderation serialize through their shared table/account locks."""
    from rest_framework.test import APIRequestFactory, force_authenticate
    admin = User.objects.create_superuser(username="race-admin", password="not-used")
    user = User.objects.create_user(username="race-player", chip_balance=1000, disclaimer_accepted_at=timezone.now())
    table = PokerTable.objects.create(name="Race", host=user, max_players=6, buy_in=100,
        minimum_balance=100, small_blind=5, big_blind=10)
    barrier = Barrier(2)
    def run(action):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            if action == "join":
                try:
                    join_table(table.pk, user.pk)
                    return 200
                except APIException as error:
                    return error.status_code
            request = APIRequestFactory().post("/", {"action": moderate,
                "expected": "waiting" if moderate == "close" else "active", "reason": "Race test"}, format="json")
            force_authenticate(request, user=admin)
            view, target = (TableActionView, table.pk) if moderate == "close" else (UserActionView, user.pk)
            return view.as_view()(request, pk=target).status_code
        finally:
            close_old_connections()
    from rest_framework.exceptions import APIException
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, ["join", moderate]))
    assert sorted(results) in ([200, 409], [200, 403])
    table.refresh_from_db(); user.refresh_from_db()
    if table.status == "closed" or not user.is_active:
        assert not table.seats.exists() and user.chip_balance == 1000
    else:
        assert table.seats.get().stack == 100 and user.chip_balance == 900
