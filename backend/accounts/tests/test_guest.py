"""S4: guests choose a name without creating an account."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.services import GUEST_SESSION_SECONDS
from conftest import TEST_PASSWORD, csrf_client

pytestmark = pytest.mark.django_db
GUEST = reverse("accounts:guest")
SESSION = reverse("accounts:session")


def test_guest_picks_name_without_account():
    client = csrf_client()
    response = client.post(GUEST, {"name": "  Lucky Seven  "}, format="json")
    assert response.status_code == 201
    assert response.data["state"] == "guest"
    assert response.data["user"] is None
    assert response.data["guest"] == {"name": "Lucky Seven"}
    assert not get_user_model().objects.exists()
    assert client.get(SESSION).data["guest"] == {"name": "Lucky Seven"}


def test_guest_session_expires(guest_client):
    assert guest_client.session.get_expiry_age() == GUEST_SESSION_SECONDS


def test_guest_can_change_name(guest_client):
    response = guest_client.post(GUEST, {"name": "New Name"}, format="json")
    assert response.status_code == 201
    assert guest_client.get(SESSION).data["guest"] == {"name": "New Name"}


def test_guests_may_share_a_name(guest_client):
    assert csrf_client().post(GUEST, {"name": "Guest Ace"}, format="json").status_code == 201


@pytest.mark.parametrize("name", ["", "   ", "a", "x" * 21, "<script>", "emoji🂡"])
def test_invalid_guest_names(name):
    client = csrf_client()
    response = client.post(GUEST, {"name": name}, format="json")
    assert response.status_code == 400 and "name" in response.data
    assert client.get(SESSION).data["state"] == "anonymous"


def test_guest_cannot_use_registered_username(registered_user):
    response = csrf_client().post(GUEST, {"name": "REGISTERED-player"}, format="json")
    assert response.status_code == 400
    assert response.data["name"] == ["That name belongs to a registered player."]


def test_signed_in_user_cannot_become_guest(registered_client):
    response = registered_client.post(GUEST, {"name": "Sneaky"}, format="json")
    assert response.status_code == 400
    assert registered_client.get(SESSION).data["state"] == "registered"


def test_guest_requires_csrf():
    client = APIClient(enforce_csrf_checks=True)
    assert client.post(GUEST, {"name": "Lucky"}, format="json").status_code == 403


def test_guest_logout_clears_name(guest_client):
    response = guest_client.post(reverse("accounts:logout"))
    assert response.data["state"] == "anonymous"
    assert guest_client.get(SESSION).data["guest"] is None


def test_guest_login_drops_guest_marker(guest_client, registered_user):
    response = guest_client.post(
        reverse("accounts:login"),
        {"username": registered_user.username, "password": TEST_PASSWORD},
        format="json",
    )
    assert response.status_code == 200 and response.data["guest"] is None
    assert "is_guest" not in guest_client.session
