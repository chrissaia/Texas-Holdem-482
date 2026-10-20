import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.urls import reverse
from rest_framework.test import APIClient

from tables.models import MAX_CHIPS, PokerTable

pytestmark = pytest.mark.django_db


@pytest.fixture
def host():
    return get_user_model().objects.create_user(
        username="chris-test", email="private@example.com", password="test-password-482"
    )


@pytest.fixture
def payload():
    return dict(name="Friday poker", max_players=6, buy_in=1000,
                minimum_balance=1000, small_blind=25, big_blind=50)


@pytest.fixture
def client(host):
    client = APIClient()
    client.force_authenticate(host)
    return client


def test_create_persists_public_empty_table(client, host, payload):
    response = client.post(reverse("tables:create"), {**payload, "name": "  Friday poker  "}, format="json")
    assert response.status_code == 201
    table = PokerTable.objects.get(pk=response.data["id"])
    assert table.name == "Friday poker"
    assert table.host == host
    assert table.is_public and table.player_count == 0 and table.status == "waiting"
    assert table.last_activity_at >= table.created_at
    assert response.data["host"] == {"id": host.pk, "username": host.username}
    assert "private@example.com" not in response.content.decode()
    assert "password" not in response.content.decode()
    assert str(table) == "Friday poker"
    # Detail GET is public and still works without a session.
    detail = APIClient().get(reverse("tables:detail", args=[table.pk]))
    assert detail.status_code == 200 and detail.data == response.data


@pytest.mark.parametrize("capacity", [2, 4, 6, 8, 9])
def test_all_design_capacities(client, payload, capacity):
    assert client.post(reverse("tables:create"), {**payload, "max_players": capacity}, format="json").status_code == 201


@pytest.mark.parametrize("changes,field", [
    ({"name": "   "}, "name"), ({"name": "x" * 81}, "name"),
    ({"max_players": 3}, "max_players"), ({"max_players": 10}, "max_players"),
    ({"big_blind": 51}, "big_blind"), ({"buy_in": 49}, "buy_in"),
    ({"minimum_balance": 999}, "minimum_balance"),
    ({"small_blind": MAX_CHIPS}, "small_blind"),
    ({"buy_in": MAX_CHIPS + 1}, "buy_in"), ({"name": None}, "name"),
])
def test_invalid_settings_do_not_persist(client, payload, changes, field):
    response = client.post(reverse("tables:create"), {**payload, **changes}, format="json")
    assert response.status_code == 400 and field in response.data
    assert not PokerTable.objects.exists()


@pytest.mark.parametrize("field", ["buy_in", "minimum_balance", "small_blind", "big_blind", "max_players"])
@pytest.mark.parametrize("bad_value", [0, -1, 2.5, True, "abc", None])
def test_invalid_numeric_values(client, payload, field, bad_value):
    response = client.post(reverse("tables:create"), {**payload, field: bad_value}, format="json")
    assert response.status_code == 400 and field in response.data
    assert not PokerTable.objects.exists()


@pytest.mark.parametrize("field,value", [
    ("host", 100), ("is_public", False), ("player_count", 4), ("status", "playing"),
    ("id", 99), ("created_at", "2020-01-01"), ("last_activity_at", "2020-01-01"),
    ("bots", 2),
])
def test_rejects_server_fields_and_unknown_options(client, payload, field, value):
    response = client.post(reverse("tables:create"), {**payload, field: value}, format="json")
    assert response.status_code == 400 and field in response.data
    assert not PokerTable.objects.exists()


def test_missing_fields_and_wrong_body_shape(client):
    response = client.post(reverse("tables:create"), {}, format="json")
    assert response.status_code == 400 and "name" in response.data
    response = client.post(reverse("tables:create"), [], format="json")
    assert response.status_code == 400 and "non_field_errors" in response.data


def test_chip_upper_boundary_and_duplicate_names(client, payload):
    data = {**payload, "small_blind": MAX_CHIPS // 2, "big_blind": MAX_CHIPS - 1,
            "buy_in": MAX_CHIPS, "minimum_balance": MAX_CHIPS}
    for _ in range(2):
        assert client.post(reverse("tables:create"), data, format="json").status_code == 201
    assert PokerTable.objects.count() == 2


def test_anonymous_and_session_guests_cannot_create(payload, host):
    client = APIClient()
    assert client.post(reverse("tables:create"), payload, format="json").status_code == 403
    client.force_login(host)
    session = client.session
    session["is_guest"] = True
    session.save()
    assert client.post(reverse("tables:create"), payload, format="json").status_code == 403
    assert client.get(reverse("tables:creation-context")).data["host"] is None
    assert not PokerTable.objects.exists()


def test_user_guest_marker_and_inactive_users_denied(client, host, payload):
    host.is_guest = True
    assert client.post(reverse("tables:create"), payload, format="json").status_code == 403
    host.is_guest = False
    host.is_active = False
    assert client.post(reverse("tables:create"), payload, format="json").status_code == 403


def test_real_session_requires_csrf(host, payload):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(host)
    assert client.post(reverse("tables:create"), payload, format="json").status_code == 403
    context = client.get(reverse("tables:creation-context"))
    assert context.status_code == 200
    assert context.data["host"] == {"id": host.pk, "username": host.username}
    assert "csrftoken" in client.cookies
    assert "no-store" in context["Cache-Control"]
    response = client.post(reverse("tables:create"), payload, format="json",
                           HTTP_X_CSRFTOKEN=context.data["csrf_token"])
    assert response.status_code == 201


def test_anonymous_context_and_private_missing_details(host, payload):
    client = APIClient()
    assert client.get(reverse("tables:creation-context")).data["host"] is None
    table = PokerTable.objects.create(host=host, is_public=False, **payload)
    for pk in [table.pk, table.pk + 1]:
        assert client.get(reverse("tables:detail", args=[pk])).status_code == 404
    assert client.post(reverse("tables:detail", args=[table.pk]), {}, format="json").status_code == 405


@pytest.mark.parametrize("changes", [
    {"max_players": 3}, {"buy_in": 0}, {"minimum_balance": 0},
    {"small_blind": 0}, {"big_blind": 0}, {"big_blind": 51},
    {"buy_in": 49}, {"minimum_balance": 999}, {"player_count": 7},
    {"status": "invalid"}, {"name": "  "},
])
def test_database_constraints_even_without_serializer(host, payload, changes):
    with pytest.raises(IntegrityError), transaction.atomic():
        PokerTable.objects.create(host=host, **{**payload, **changes})
    assert not PokerTable.objects.exists()


def test_host_deletion_protected_and_model_clean(host, payload):
    PokerTable.objects.create(host=host, **payload)
    with pytest.raises(ProtectedError):
        host.delete()
    with pytest.raises(ValidationError):
        PokerTable(name="  ").clean()
