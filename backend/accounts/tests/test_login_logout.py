"""S1: login and logout, invalid credentials, and session invalidation."""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from conftest import TEST_PASSWORD, csrf_client

pytestmark = pytest.mark.django_db
LOGIN = reverse("accounts:login")
LOGOUT = reverse("accounts:logout")
SESSION = reverse("accounts:session")


def test_anonymous_session_sets_csrf_cookie():
    client = APIClient()
    response = client.get(SESSION)
    assert response.status_code == 200
    assert response.data == {
        "state": "anonymous", "user": None, "guest": None, "csrf_token": response.data["csrf_token"],
    }
    assert "csrftoken" in client.cookies
    assert "no-cache" in response["Cache-Control"]


def test_login_starts_registered_session(registered_user):
    client = csrf_client()
    response = client.post(LOGIN, {"username": "Registered-Player", "password": TEST_PASSWORD}, format="json")
    assert response.status_code == 200
    assert response.data["state"] == "registered"
    assert response.data["user"]["username"] == "registered-player"
    assert response.data["user"]["is_admin"] is False
    assert "password" not in response.content.decode()
    registered_user.refresh_from_db()
    assert registered_user.last_login is not None
    assert client.get(SESSION).data["user"]["id"] == registered_user.pk


def test_admin_session_reports_admin(rivr_admin_client):
    assert rivr_admin_client.get(SESSION).data["user"]["is_admin"] is True


def test_login_rotates_session_key(guest_client, registered_user):
    # Session fixation: a session ID that existed before login must not survive it.
    before = guest_client.cookies["sessionid"].value
    guest_client.post(LOGIN, {"username": registered_user.username, "password": TEST_PASSWORD}, format="json")
    assert guest_client.cookies["sessionid"].value != before


@pytest.mark.parametrize("credentials", [
    {"username": "registered-player", "password": "wrong-password"},
    {"username": "nobody-here", "password": TEST_PASSWORD},
])
def test_invalid_credentials_share_one_message(registered_user, credentials):
    client = csrf_client()
    response = client.post(LOGIN, credentials, format="json")
    assert response.status_code == 400
    assert response.data == {"non_field_errors": ["Invalid username or password."]}
    assert client.get(SESSION).data["state"] == "anonymous"


def test_inactive_account_cannot_log_in(registered_user):
    registered_user.is_active = False
    registered_user.save()
    response = csrf_client().post(
        LOGIN, {"username": registered_user.username, "password": TEST_PASSWORD}, format="json"
    )
    assert response.status_code == 400
    assert response.data == {"non_field_errors": ["Invalid username or password."]}


@pytest.mark.parametrize("body", [{}, {"username": "x"}, {"password": "x"}, {"username": "", "password": ""}])
def test_login_requires_both_fields(body):
    assert csrf_client().post(LOGIN, body, format="json").status_code == 400


def test_login_requires_csrf(registered_user):
    client = APIClient(enforce_csrf_checks=True)
    response = client.post(LOGIN, {"username": registered_user.username, "password": TEST_PASSWORD}, format="json")
    assert response.status_code == 403
    assert client.get(SESSION).data["state"] == "anonymous"


def test_login_rejects_get(registered_user):
    assert csrf_client().get(LOGIN).status_code == 405


def test_logout_ends_session(registered_client):
    response = registered_client.post(LOGOUT)
    assert response.status_code == 200
    assert response.data["state"] == "anonymous"
    assert registered_client.get(SESSION).data["state"] == "anonymous"


def test_old_session_cookie_is_invalid_after_logout(registered_client):
    stolen = registered_client.cookies["sessionid"].value
    registered_client.post(LOGOUT)
    replay = APIClient()
    replay.cookies["sessionid"] = stolen
    assert replay.get(SESSION).data["state"] == "anonymous"


def test_logout_requires_csrf(registered_user):
    client = APIClient(enforce_csrf_checks=True)
    client.login(username=registered_user.username, password=TEST_PASSWORD)
    assert client.post(LOGOUT).status_code == 403
    assert client.get(SESSION).data["state"] == "registered"


def test_anonymous_logout_is_harmless():
    response = csrf_client().post(LOGOUT)
    assert response.status_code == 200 and response.data["state"] == "anonymous"
