from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from queue import Queue
from time import monotonic, sleep

import pytest
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth.models import AnonymousUser, Permission
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.db import close_old_connections, connection, transaction
from django.test import Client
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from tables.cleanup import cleanup_tables
from tables.models import PokerTable

pytestmark = pytest.mark.django_db
ACTION = "cleanup_old_empty_tables"


@pytest.fixture(autouse=True)
def default_cleanup_threshold(settings):
    """Keep acceptance tests independent of a developer's temporary demo setting."""
    settings.TABLE_CLEANUP_INACTIVITY_MINUTES = 30


@pytest.fixture
def table_factory(registered_user):
    def create(**changes):
        values = dict(
            name="Cleanup test table", host=registered_user, max_players=6,
            buy_in=1000, minimum_balance=1000, small_blind=25, big_blind=50,
            last_activity_at=timezone.now() - timedelta(hours=2),
        )
        values.update(changes)
        return PokerTable.objects.create(**values)
    return create


def admin_client(user=None, *, csrf=False):
    client = Client(enforce_csrf_checks=csrf)
    if user is not None:
        client.force_login(user)
    return client


def action_data(*tables, confirm=False):
    data = {"action": ACTION, "_selected_action": [str(table.pk) for table in tables]}
    if confirm:
        data["confirm_cleanup"] = "yes"
    return data


def changelist():
    return reverse("admin:tables_pokertable_changelist")


def test_deletes_old_empty_public_and_audits_actor_and_identity(table_factory, rivr_admin):
    table = table_factory(name="Old empty public table")
    table_id = table.pk
    result = cleanup_tables(actor=rivr_admin, table_ids=[table_id])
    assert result.deleted_ids == (table_id,)
    assert result.skipped_count == 0
    assert not PokerTable.objects.filter(pk=table_id).exists()
    entry = LogEntry.objects.get(action_flag=DELETION, object_id=str(table_id))
    assert entry.user_id == rivr_admin.pk
    assert entry.object_repr == "Old empty public table"
    assert entry.content_type.model == "pokertable"
    assert "S23 cleanup" in entry.change_message


@pytest.mark.parametrize("changes", [
    {"player_count": 1},
    {"is_public": False},
    {"status": PokerTable.Status.PLAYING},
    {"last_activity_at": "recent"},
])
def test_preserves_ineligible_tables(changes, table_factory, rivr_admin):
    changes = {
        key: timezone.now() if value == "recent" else value
        for key, value in changes.items()
    }
    table = table_factory(**changes)
    result = cleanup_tables(actor=rivr_admin, table_ids=[table.pk])
    assert result.deleted_ids == ()
    assert result.skipped_count == 1
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


def test_strict_cutoff_uses_last_activity_not_creation_time(table_factory, rivr_admin):
    now = timezone.now()
    cutoff = now - timedelta(minutes=30)
    old = table_factory(last_activity_at=cutoff - timedelta(microseconds=1))
    boundary = table_factory(last_activity_at=cutoff)
    recent = table_factory(
        created_at=now - timedelta(days=10),
        last_activity_at=cutoff + timedelta(microseconds=1),
    )
    result = cleanup_tables(actor=rivr_admin, table_ids=[old.pk, boundary.pk, recent.pk], now=now)
    assert result.deleted_ids == (old.pk,)
    assert set(PokerTable.objects.values_list("pk", flat=True)) == {boundary.pk, recent.pk}


def test_closed_empty_public_tables_are_also_eligible(table_factory, rivr_admin):
    table = table_factory(status=PokerTable.Status.CLOSED)
    assert cleanup_tables(actor=rivr_admin, table_ids=[table.pk]).deleted_ids == (table.pk,)


def test_only_selected_tables_are_deleted_and_retries_are_safe(table_factory, rivr_admin):
    selected = table_factory()
    unselected = table_factory()
    result = cleanup_tables(actor=rivr_admin, table_ids=[selected.pk, selected.pk])
    assert result.deleted_ids == (selected.pk,)
    assert PokerTable.objects.filter(pk=unselected.pk).exists()
    repeat = cleanup_tables(actor=rivr_admin, table_ids=[selected.pk])
    assert repeat.deleted_ids == ()
    assert repeat.skipped_count == 1
    assert LogEntry.objects.count() == 1
    assert cleanup_tables(actor=rivr_admin, table_ids=[]).deleted_ids == ()


def test_configured_threshold_is_used(settings, table_factory, rivr_admin):
    settings.TABLE_CLEANUP_INACTIVITY_MINUTES = 60
    table = table_factory(last_activity_at=timezone.now() - timedelta(minutes=45))
    assert cleanup_tables(actor=rivr_admin, table_ids=[table.pk]).deleted_ids == ()
    settings.TABLE_CLEANUP_INACTIVITY_MINUTES = 30
    assert cleanup_tables(actor=rivr_admin, table_ids=[table.pk]).deleted_ids == (table.pk,)


@pytest.mark.parametrize("value", [0, -1, True, "30", 1.5, None])
def test_invalid_threshold_never_deletes(value, settings, table_factory, rivr_admin):
    settings.TABLE_CLEANUP_INACTIVITY_MINUTES = value
    table = table_factory()
    with pytest.raises(ImproperlyConfigured):
        cleanup_tables(actor=rivr_admin, table_ids=[table.pk])
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


@pytest.mark.parametrize("actor_kind", ["anonymous", "ordinary", "inactive", "staff_without_permission"])
def test_service_denies_unauthorized_actors(actor_kind, registered_user, rivr_admin, table_factory):
    table = table_factory()
    if actor_kind == "anonymous":
        actor = AnonymousUser()
    elif actor_kind == "inactive":
        actor = rivr_admin
        actor.is_active = False
    else:
        actor = registered_user
        actor.is_staff = actor_kind == "staff_without_permission"
    with pytest.raises(PermissionDenied):
        cleanup_tables(actor=actor, table_ids=[table.pk])
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


def test_non_staff_with_delete_permission_is_still_denied(registered_user, table_factory):
    table = table_factory()
    registered_user.user_permissions.add(
        Permission.objects.get(codename="delete_pokertable", content_type__app_label="tables")
    )
    with pytest.raises(PermissionDenied):
        cleanup_tables(actor=registered_user, table_ids=[table.pk])


def test_staff_with_table_permissions_can_confirm_cleanup(registered_user, table_factory):
    table = table_factory()
    registered_user.is_staff = True
    registered_user.save(update_fields=["is_staff"])
    registered_user.user_permissions.add(*Permission.objects.filter(
        content_type__app_label="tables",
        codename__in=["view_pokertable", "delete_pokertable"],
    ))
    client = admin_client(registered_user)
    response = client.post(changelist(), action_data(table, confirm=True), follow=True)
    assert response.status_code == 200
    assert not PokerTable.objects.filter(pk=table.pk).exists()
    assert LogEntry.objects.get().user_id == registered_user.pk


def test_admin_preview_does_not_delete_and_confirmation_reports_skips(table_factory, rivr_admin):
    old = table_factory(name="<script>untrusted name</script>")
    occupied = table_factory(player_count=2)
    client = admin_client(rivr_admin)
    preview = client.post(changelist(), action_data(old, occupied))
    assert preview.status_code == 200
    assert "Confirm cleanup" in preview.content.decode()
    assert "&lt;script&gt;" in preview.content.decode()
    assert PokerTable.objects.count() == 2
    assert not LogEntry.objects.exists()
    confirmed = client.post(changelist(), action_data(old, occupied, confirm=True), follow=True)
    assert confirmed.status_code == 200
    assert "Deleted 1 old empty public table(s). Skipped 1 selected table(s)." in confirmed.content.decode()
    assert PokerTable.objects.filter(pk=occupied.pk).exists()


@pytest.mark.parametrize("user_kind", ["anonymous", "ordinary", "staff_without_delete"])
def test_admin_http_denies_cleanup(user_kind, table_factory, registered_user):
    table = table_factory()
    user = None if user_kind == "anonymous" else registered_user
    if user_kind == "staff_without_delete":
        user.is_staff = True
        user.save(update_fields=["is_staff"])
        user.user_permissions.add(Permission.objects.get(
            codename="view_pokertable", content_type__app_label="tables",
        ))
    client = admin_client(user)
    response = client.post(changelist(), action_data(table, confirm=True))
    if user_kind == "staff_without_delete":
        assert response.status_code == 200
        assert ACTION not in response.content.decode()
    else:
        assert response.status_code == 302
        assert reverse("admin:login") in response.url
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


def test_confirm_requires_csrf_even_for_admin(table_factory, rivr_admin):
    table = table_factory()
    client = admin_client(rivr_admin, csrf=True)
    assert client.post(changelist(), action_data(table, confirm=True)).status_code == 403
    assert PokerTable.objects.filter(pk=table.pk).exists()
    client.get(changelist())
    token = client.cookies["csrftoken"].value
    response = client.post(
        changelist(), {**action_data(table, confirm=True), "csrfmiddlewaretoken": token},
    )
    assert response.status_code == 302
    assert not PokerTable.objects.filter(pk=table.pk).exists()


def test_admin_get_never_deletes(table_factory, rivr_admin):
    table = table_factory()
    response = admin_client(rivr_admin).get(changelist(), action_data(table, confirm=True))
    assert response.status_code in (200, 302)
    assert PokerTable.objects.filter(pk=table.pk).exists()


@pytest.mark.parametrize("confirm", [False, True])
def test_admin_configuration_error_is_reported_without_deleting(
    confirm, settings, table_factory, rivr_admin,
):
    settings.TABLE_CLEANUP_INACTIVITY_MINUTES = 0
    table = table_factory()
    response = admin_client(rivr_admin).post(
        changelist(), action_data(table, confirm=confirm), follow=True,
    )
    assert "must be a positive whole number" in response.content.decode()
    assert PokerTable.objects.filter(pk=table.pk).exists()


def test_failed_batch_rolls_back_deletions_and_audit_entries(table_factory, rivr_admin, monkeypatch):
    first, second = table_factory(), table_factory()
    original_delete = PokerTable.delete

    def fail_second(self, *args, **kwargs):
        if self.pk == second.pk:
            raise RuntimeError("simulated delete failure")
        return original_delete(self, *args, **kwargs)

    monkeypatch.setattr(PokerTable, "delete", fail_second)
    with pytest.raises(RuntimeError):
        cleanup_tables(actor=rivr_admin, table_ids=[first.pk, second.pk])
    assert PokerTable.objects.count() == 2
    assert not LogEntry.objects.exists()


def test_cleanup_updates_real_lobby_and_detail_api(table_factory, rivr_admin):
    removed, kept = table_factory(), table_factory(player_count=1)
    api = APIClient()
    before = api.get(reverse("tables:create"))
    assert before.data["count"] == 2
    result = admin_client(rivr_admin).post(changelist(), action_data(removed, kept, confirm=True))
    assert result.status_code == 302
    after = api.get(reverse("tables:create"))
    assert after.data["count"] == after.data["total_tables"] == 1
    assert after.data["total_players"] == 1
    assert [row["id"] for row in after.data["results"]] == [kept.pk]
    assert api.get(reverse("tables:detail", args=[removed.pk])).status_code == 404


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("change", [
    {"player_count": 1},
    {"last_activity_at": "now"},
    {"is_public": False},
    {"status": PokerTable.Status.PLAYING},
])
def test_cleanup_waits_for_writer_and_rechecks_committed_row(
    change, table_factory, rivr_admin,
):
    assert connection.vendor == "postgresql"
    table = table_factory()
    worker_pid = Queue()

    def cleanup_worker():
        close_old_connections()
        try:
            connection.ensure_connection()
            worker_pid.put(connection.connection.info.backend_pid)
            return cleanup_tables(actor=rivr_admin, table_ids=[table.pk])
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=1) as pool:
        with transaction.atomic():
            locked = PokerTable.objects.select_for_update().get(pk=table.pk)
            future = pool.submit(cleanup_worker)
            pid = worker_pid.get(timeout=5)
            # Prove the cleanup query is actually waiting on our PostgreSQL lock.
            deadline = monotonic() + 5
            while True:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_blocking_pids(%s)", [pid])
                    blocked = bool(cursor.fetchone()[0])
                if blocked:
                    break
                if monotonic() >= deadline:
                    pytest.fail("Cleanup did not wait for the table writer's row lock")
                sleep(0.01)
            changes = {
                key: timezone.now() if value == "now" else value
                for key, value in change.items()
            }
            for key, value in changes.items():
                setattr(locked, key, value)
            locked.save(update_fields=list(changes))
        result = future.result(timeout=5)
    assert result.deleted_ids == ()
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


def test_direct_admin_action_also_checks_permission(registered_user, table_factory):
    from django.contrib import admin
    from django.test import RequestFactory

    table = table_factory()
    request = RequestFactory().post(changelist(), action_data(table, confirm=True))
    request.user = registered_user
    model_admin = admin.site._registry[PokerTable]
    with pytest.raises(PermissionDenied):
        model_admin.cleanup_old_empty_tables(request, PokerTable.objects.all())
    assert PokerTable.objects.filter(pk=table.pk).exists()


@pytest.mark.django_db(transaction=True)
def test_competing_cleanups_delete_and_audit_once(table_factory, rivr_admin):
    from threading import Barrier

    table = table_factory()
    barrier = Barrier(2)

    def cleanup_worker():
        close_old_connections()
        try:
            barrier.wait(timeout=5)
            return cleanup_tables(actor=rivr_admin, table_ids=[table.pk])
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(cleanup_worker) for _ in range(2)]
        results = [future.result(timeout=10) for future in futures]
    assert sorted(len(result.deleted_ids) for result in results) == [0, 1]
    assert sorted(result.skipped_count for result in results) == [0, 1]
    assert not PokerTable.objects.filter(pk=table.pk).exists()
    assert LogEntry.objects.filter(object_id=str(table.pk), action_flag=DELETION).count() == 1


def test_real_guest_session_cannot_cleanup(guest_client, table_factory):
    table = table_factory()
    response = guest_client.post(changelist(), action_data(table, confirm=True))
    assert response.status_code == 302
    assert reverse("admin:login") in response.url
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


@pytest.mark.parametrize("change", [
    {"player_count": 1},
    {"last_activity_at": "now"},
    {"is_public": False},
    {"status": PokerTable.Status.PLAYING},
])
def test_admin_rechecks_changes_between_preview_and_confirmation(
    change, table_factory, rivr_admin,
):
    table = table_factory()
    client = admin_client(rivr_admin)
    preview = client.post(changelist(), action_data(table))
    assert preview.status_code == 200
    updates = {
        key: timezone.now() if value == "now" else value
        for key, value in change.items()
    }
    PokerTable.objects.filter(pk=table.pk).update(**updates)
    response = client.post(changelist(), action_data(table, confirm=True), follow=True)
    assert response.status_code == 200
    assert "Deleted 0 old empty public table(s). Skipped 1 selected table(s)." in response.content.decode()
    assert PokerTable.objects.filter(pk=table.pk).exists()
    assert not LogEntry.objects.exists()


def test_confirmation_form_retains_selection_and_does_not_delete_unselected(
    table_factory, rivr_admin,
):
    from html.parser import HTMLParser

    class ConfirmationParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.inputs = {}

        def handle_starttag(self, tag, attrs):
            fields = dict(attrs)
            if tag == "input" and fields.get("type") == "hidden":
                self.inputs.setdefault(fields["name"], []).append(fields.get("value", ""))

    selected, unselected = table_factory(), table_factory()
    client = admin_client(rivr_admin)
    preview = client.post(changelist(), action_data(selected))
    parser = ConfirmationParser()
    parser.feed(preview.content.decode())
    assert parser.inputs["_selected_action"] == [str(selected.pk)]
    assert parser.inputs["action"] == [ACTION]
    assert parser.inputs["confirm_cleanup"] == ["yes"]
    response = client.post(changelist(), parser.inputs)
    assert response.status_code == 302
    assert not PokerTable.objects.filter(pk=selected.pk).exists()
    assert PokerTable.objects.filter(pk=unselected.pk).exists()
