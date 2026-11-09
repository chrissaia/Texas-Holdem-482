"""S17 real event aggregation, private session access, and refresh persistence."""
import pytest
from django.contrib.auth import get_user_model
from django.db import transaction
from django.urls import reverse
from rest_framework.test import APIClient

from chips.services import save_chip_result
from conftest import sign_in
from profiles.rewards import grant_starting_chips, claim_daily_chips
from progression.models import Event
from progression.services import record_event

pytestmark = pytest.mark.django_db


def url():
    return reverse("profiles:statistics")


def test_new_account_has_truthful_empty_statistics(registered_client, registered_user):
    response = registered_client.get(url())
    assert response.status_code == 200
    assert response.data == {
        "username": registered_user.username, "period": "all_time", "hands_played": 0,
        "hands_won": 0, "hands_lost": 0, "hands_split": 0, "win_rate": 0.0,
    }
    assert "no-store" in response["Cache-Control"]


def test_counts_real_hand_events_once_and_excludes_other_players_and_kinds(registered_user, registered_client):
    for source, outcome in [("one", "win"), ("two", "loss"), ("three", "split")]:
        record_event(registered_user.pk, "hand", source, outcome=outcome)
    record_event(registered_user.pk, "hand", "one", outcome="win")
    record_event(registered_user.pk, "game", "table-created")
    record_event(registered_user.pk, "avatar", "photo")
    other = get_user_model().objects.create_user(username="other-stats")
    record_event(other.pk, "hand", "one", outcome="win")
    data = registered_client.get(url()).data
    assert data["hands_played"] == 3
    assert (data["hands_won"], data["hands_lost"], data["hands_split"]) == (1, 1, 1)
    assert data["win_rate"] == 33.3
    assert not {"email", "facts", "source", "user_id", "chip_balance"} & data.keys()


@pytest.mark.parametrize("outcome,expected", [("win", 100.0), ("loss", 0.0), ("split", 0.0)])
def test_win_rate_endpoints_and_split_policy(registered_user, registered_client, outcome, expected):
    record_event(registered_user.pk, "hand", "one", outcome=outcome)
    data = registered_client.get(url()).data
    assert data["hands_played"] == 1
    assert data["win_rate"] == expected


def test_rewards_and_wallet_changes_are_not_invented_hands(registered_user, registered_client):
    grant_starting_chips(registered_user.pk)
    claim_daily_chips(registered_user.pk)
    save_chip_result(registered_user.pk, source="wallet-test", delta=100)
    assert registered_client.get(url()).data["hands_played"] == 0


def test_refresh_and_new_session_read_persisted_events(registered_user, registered_client):
    assert registered_client.get(url()).data["hands_played"] == 0
    record_event(registered_user.pk, "hand", "saved", outcome="win")
    assert registered_client.get(url()).data["hands_won"] == 1
    registered_client.post(reverse("accounts:logout"), {}, format="json")
    assert registered_client.get(url()).status_code == 403
    fresh = sign_in(registered_user.username)
    assert fresh.get(url()).data["hands_won"] == 1


def test_failed_result_transaction_does_not_change_statistics(registered_user, registered_client):
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            record_event(registered_user.pk, "hand", "rollback", outcome="win")
            raise RuntimeError("settlement failed")
    assert registered_client.get(url()).data["hands_played"] == 0
    assert not Event.objects.exists()


def test_guests_anonymous_and_inactive_accounts_are_denied(registered_user, registered_client, guest_client):
    assert APIClient().get(url()).status_code == 403
    assert guest_client.get(url()).status_code == 403
    registered_user.is_active = False
    registered_user.save()
    assert registered_client.get(url()).status_code == 403


@pytest.mark.parametrize("query", ["user_id=123", "username=someone-else", "period=last_week"])
def test_cannot_select_someone_elses_stats_or_unsupported_period(registered_client, query):
    assert registered_client.get(url() + "?" + query).status_code == 400


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_browser_cannot_write_poker_statistics(registered_client, method):
    assert getattr(registered_client, method)(url(), {"hands_won": 999}, format="json").status_code == 405
    assert not Event.objects.exists()
