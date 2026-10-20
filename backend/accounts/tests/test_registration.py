"""S2: registration with unique usernames/emails, hashed passwords, and validation."""
import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.urls import reverse

from accounts import services
from accounts.serializers import RegistrationSerializer
from conftest import csrf_client

pytestmark = pytest.mark.django_db
User = get_user_model()
URL = reverse("accounts:register")


@pytest.fixture
def payload():
    return {"username": "river_rat", "email": "River.Rat@Example.com", "password": "flop-turn-river-9"}


def test_register_creates_hashed_account_and_signs_in(payload):
    client = csrf_client()
    response = client.post(URL, payload, format="json")
    assert response.status_code == 201
    user = User.objects.get(username="river_rat")
    assert user.email == "river.rat@example.com"
    assert user.password != payload["password"] and user.check_password(payload["password"])
    assert not user.is_staff and not user.is_superuser
    assert response.data["state"] == "registered"
    assert response.data["user"] == {
        "id": user.pk, "username": "river_rat", "email": "river.rat@example.com", "is_admin": False,
    }
    assert payload["password"] not in response.content.decode()
    assert client.get(reverse("accounts:session")).data["state"] == "registered"


def test_duplicate_username_is_case_insensitive(payload, registered_user):
    response = csrf_client().post(URL, {**payload, "username": "REGISTERED-player"}, format="json")
    assert response.status_code == 400
    assert response.data["username"] == ["A user with that username already exists."]


def test_duplicate_email_is_case_insensitive(payload, registered_user):
    response = csrf_client().post(URL, {**payload, "email": "PLAYER@example.com"}, format="json")
    assert response.status_code == 400
    assert response.data["email"] == ["An account with that email already exists."]


@pytest.mark.parametrize("changes,field", [
    ({"username": "ab"}, "username"),
    ({"username": "x" * 31}, "username"),
    ({"username": "bad name!"}, "username"),
    ({"email": "not-an-email"}, "email"),
    ({"email": ""}, "email"),
    ({"password": "short"}, "password"),
    ({"password": "password123"}, "password"),
    ({"password": "84629173058"}, "password"),
    ({"password": "river_rat_1"}, "password"),
    ({"is_staff": True}, "is_staff"),
])
def test_invalid_registration_is_rejected(payload, changes, field):
    response = csrf_client().post(URL, {**payload, **changes}, format="json")
    assert response.status_code == 400
    assert field in response.data
    assert not User.objects.exists()


@pytest.mark.parametrize("missing", ["username", "email", "password"])
def test_required_fields(payload, missing):
    del payload[missing]
    response = csrf_client().post(URL, payload, format="json")
    assert response.status_code == 400 and missing in response.data


def test_database_enforces_case_insensitive_uniqueness():
    User.objects.create_user(username="Mira", email="mira@example.com")
    for duplicate in ({"username": "mira"}, {"username": "other", "email": "MIRA@example.com"}):
        with pytest.raises(IntegrityError), transaction.atomic():
            User.objects.create_user(**{"email": "", **duplicate})
    # Blank emails stay allowed for admin-created and fixture accounts.
    User.objects.create_user(username="no-email-1")
    User.objects.create_user(username="no-email-2")


def test_simultaneous_registration_race_returns_400(payload, monkeypatch):
    # Simulate another request committing the name after this request validated it.
    User.objects.create_user(username="river_rat", email="first@example.com")
    monkeypatch.setattr(RegistrationSerializer, "validate_username", lambda self, value: value)
    response = csrf_client().post(URL, payload, format="json")
    assert response.status_code == 400
    assert "non_field_errors" in response.data
    assert User.objects.filter(username__iexact="river_rat").count() == 1


def test_failure_inside_registration_rolls_back_account(payload, monkeypatch):
    # Stands in for a failed starting-chip grant inside the same transaction.
    real_create = User.objects.create_user

    def create_then_fail(**kwargs):
        real_create(**kwargs)
        raise RuntimeError("grant failed")

    monkeypatch.setattr(User.objects, "create_user", create_then_fail)
    with pytest.raises(RuntimeError):
        services.register_user(**payload)
    assert not User.objects.exists()


def test_registration_requires_csrf(payload):
    from rest_framework.test import APIClient

    response = APIClient(enforce_csrf_checks=True).post(URL, payload, format="json")
    assert response.status_code == 403
    assert not User.objects.exists()


def test_signed_in_user_cannot_register_again(payload, registered_client):
    response = registered_client.post(URL, payload, format="json")
    assert response.status_code == 400
    assert not User.objects.filter(username="river_rat").exists()


def test_guest_can_register_and_loses_guest_marker(payload, guest_client):
    response = guest_client.post(URL, payload, format="json")
    assert response.status_code == 201
    assert response.data["state"] == "registered" and response.data["guest"] is None
    assert "is_guest" not in guest_client.session
