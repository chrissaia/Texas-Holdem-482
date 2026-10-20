"""Permission boundaries between anonymous, guest, registered, and admin sessions."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from conftest import csrf_client

pytestmark = pytest.mark.django_db
TABLES = reverse("tables:create")
TABLE = dict(name="Session test", max_players=6, buy_in=1000,
             minimum_balance=1000, small_blind=25, big_blind=50)


@pytest.mark.parametrize("fixture", ["registered_client", "rivr_admin_client"])
def test_registered_and_admin_sessions_can_create_tables(request, fixture):
    client = request.getfixturevalue(fixture)
    assert client.post(TABLES, TABLE, format="json").status_code == 201


def test_guest_cannot_create_table(guest_client):
    assert guest_client.post(TABLES, TABLE, format="json").status_code == 403


def test_anonymous_cannot_create_table():
    assert csrf_client().post(TABLES, TABLE, format="json").status_code == 403


def test_logged_out_session_cannot_create_table(registered_client):
    registered_client.post(reverse("accounts:logout"))
    assert registered_client.post(TABLES, TABLE, format="json").status_code == 403


def test_registered_write_without_csrf_is_rejected(registered_client):
    registered_client.credentials()  # drop the CSRF header
    assert registered_client.post(TABLES, TABLE, format="json").status_code == 403


def test_creation_context_uses_account_session(guest_client, registered_client, registered_user):
    context = reverse("tables:creation-context")
    assert guest_client.get(context).data["host"] is None
    assert registered_client.get(context).data["host"] == {
        "id": registered_user.pk, "username": registered_user.username,
    }


def test_public_lobby_stays_open_to_everyone(guest_client):
    assert guest_client.get(TABLES).status_code == 200
    assert APIClient().get(TABLES).status_code == 200
