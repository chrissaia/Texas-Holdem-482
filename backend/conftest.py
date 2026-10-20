"""Shared account fixtures for every app's tests. Finn owns these.

The *_client fixtures sign in through the real session endpoints with CSRF
checks enabled, so tests exercise the same path as the browser.
"""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

TEST_PASSWORD = "river-card-482"


def csrf_client():
    """APIClient that enforces CSRF and already holds a token header."""
    client = APIClient(enforce_csrf_checks=True)
    token = client.get(reverse("accounts:session")).data["csrf_token"]
    client.credentials(HTTP_X_CSRFTOKEN=token)
    return client


def sign_in(username, password=TEST_PASSWORD):
    client = csrf_client()
    response = client.post(
        reverse("accounts:login"), {"username": username, "password": password}, format="json"
    )
    assert response.status_code == 200, response.data
    # Login rotates the CSRF token; keep the header in sync for later writes.
    client.credentials(HTTP_X_CSRFTOKEN=response.data["csrf_token"])
    return client


@pytest.fixture
def registered_user(db):
    return get_user_model().objects.create_user(
        username="registered-player", email="player@example.com", password=TEST_PASSWORD
    )


@pytest.fixture
def rivr_admin(db):
    return get_user_model().objects.create_superuser(
        username="rivr-admin", email="admin@example.com", password=TEST_PASSWORD
    )


@pytest.fixture
def registered_client(registered_user):
    return sign_in(registered_user.username)


@pytest.fixture
def rivr_admin_client(rivr_admin):
    return sign_in(rivr_admin.username)


@pytest.fixture
def guest_client(db):
    client = csrf_client()
    response = client.post(reverse("accounts:guest"), {"name": "Guest Ace"}, format="json")
    assert response.status_code == 201, response.data
    client.credentials(HTTP_X_CSRFTOKEN=response.data["csrf_token"])
    return client
