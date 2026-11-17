"""S3: players must accept the play-money disclaimer before taking a seat."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from conftest import TEST_PASSWORD, csrf_client, sign_in
from profiles.rewards import grant_starting_chips
from tables.models import PokerTable, TableSeat

pytestmark = pytest.mark.django_db

SESSION = reverse("accounts:session")
DISCLAIMER = reverse("accounts:disclaimer")


def accept(client, body=None):
    return client.post(DISCLAIMER, {} if body is None else body, format="json")


def test_new_account_has_not_accepted(registered_client, registered_user):
    assert registered_client.get(SESSION).data["disclaimer_accepted"] is False
    assert registered_user.disclaimer_accepted_at is None


def test_registered_acceptance_is_saved_and_survives_a_new_login(registered_client, registered_user):
    response = accept(registered_client)
    assert response.status_code == 200
    assert response.data["state"] == "registered"
    assert response.data["disclaimer_accepted"] is True
    assert response.data["csrf_token"]
    assert "no-cache" in response["Cache-Control"] or "no-store" in response["Cache-Control"]
    registered_user.refresh_from_db()
    first = registered_user.disclaimer_accepted_at
    assert first is not None

    # A fresh login on another "device" still sees the saved acceptance.
    assert sign_in(registered_user.username).get(SESSION).data["disclaimer_accepted"] is True


def test_accepting_twice_keeps_the_first_time(registered_client, registered_user):
    accept(registered_client)
    registered_user.refresh_from_db()
    first = registered_user.disclaimer_accepted_at
    assert accept(registered_client).status_code == 200
    registered_user.refresh_from_db()
    assert registered_user.disclaimer_accepted_at == first


def test_guest_acceptance_lasts_for_the_session_only(guest_client):
    assert guest_client.get(SESSION).data["disclaimer_accepted"] is False
    response = accept(guest_client)
    assert response.status_code == 200
    assert response.data["state"] == "guest"
    assert response.data["disclaimer_accepted"] is True
    assert get_user_model().objects.count() == 0

    # Logging out ends the guest session and its acceptance.
    after = guest_client.post(reverse("accounts:logout"), {}, format="json")
    assert after.data["disclaimer_accepted"] is False


def test_guest_acceptance_does_not_carry_into_an_account(guest_client, registered_user):
    accept(guest_client)
    login = guest_client.post(
        reverse("accounts:login"),
        {"username": registered_user.username, "password": TEST_PASSWORD},
        format="json",
    )
    assert login.status_code == 200
    assert login.data["disclaimer_accepted"] is False
    registered_user.refresh_from_db()
    assert registered_user.disclaimer_accepted_at is None


def test_anonymous_cannot_accept():
    response = accept(csrf_client())
    assert response.status_code == 403
    assert response.data == {"non_field_errors": ["Sign in or continue as a guest first."]}


@pytest.mark.parametrize("body", [{"accepted": True}, {"disclaimer_accepted_at": "2020-01-01T00:00:00Z"}, []])
def test_client_cannot_send_fields(registered_client, registered_user, body):
    assert accept(registered_client, body).status_code == 400
    registered_user.refresh_from_db()
    assert registered_user.disclaimer_accepted_at is None


def test_accept_requires_csrf(registered_user):
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(registered_user)
    assert accept(client).status_code == 403
    registered_user.refresh_from_db()
    assert registered_user.disclaimer_accepted_at is None


def test_only_post_is_allowed(registered_client):
    assert registered_client.get(DISCLAIMER).status_code == 405


def test_joining_a_table_requires_acceptance(registered_client, registered_user):
    grant_starting_chips(registered_user.pk)
    table = PokerTable.objects.create(
        name="Disclaimer table", host=registered_user, max_players=2, buy_in=100,
        minimum_balance=100, small_blind=5, big_blind=10,
    )
    seat_url = reverse("tables:seat", args=[table.pk])

    status = registered_client.get(seat_url)
    assert status.data["disclaimer_accepted"] is False

    refused = registered_client.post(seat_url, {}, format="json")
    assert refused.status_code == 403
    assert refused.data == {
        "detail": "Accept the play-money disclaimer before joining a table.",
        "code": "disclaimer_required",
    }
    assert not TableSeat.objects.exists()
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == 1000

    accept(registered_client)
    joined = registered_client.post(seat_url, {}, format="json")
    assert joined.status_code == 200
    assert joined.data["disclaimer_accepted"] is True
    assert joined.data["seat"]["stack"] == 100
