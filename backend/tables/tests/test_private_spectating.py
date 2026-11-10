"""S27 invitation privacy, S26 read-only snapshots and S11 buy-in range checks."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from friends.models import Friendship
from tables.models import PokerTable, TableInvitation, TableSeat

pytestmark = pytest.mark.django_db


@pytest.fixture
def private_table(registered_user):
    """Create a private waiting table owned by the signed-in fixture account."""
    return PokerTable.objects.create(host=registered_user, name="Private crew", is_public=False,
        max_players=2, buy_in=100, minimum_balance=100, small_blind=5, big_blind=10)


@pytest.fixture
def friend(registered_user):
    """Create an active accepted friend with enough chips for the waiting table."""
    user = get_user_model().objects.create_user(username="invited-friend", chip_balance=1000)
    Friendship.objects.create(from_user=registered_user, to_user=user, status="accepted")
    return user


def client_for(user):
    """Authenticate an isolated API client as the selected test account."""
    client = APIClient()
    client.force_authenticate(user)
    return client


def url(name, table):
    """Resolve a table-scoped route without hard-coded IDs."""
    return reverse("tables:" + name, args=[table.pk])


def test_private_creation_is_hidden_and_idempotent_invite_grants_join(private_table, registered_client, friend):
    """Invitees can discover, view and fund a private seat; public browsing cannot reveal it."""
    body = dict(name="New private", max_players=2, buy_in=100, minimum_balance=100, small_blind=5, big_blind=10)
    created = registered_client.post(reverse("tables:private"), body, format="json")
    assert created.status_code == 201 and created.data["is_public"] is False
    assert APIClient().get(reverse("tables:create")).data["count"] == 0
    assert client_for(friend).get(url("detail", private_table)).status_code == 404
    assert client_for(friend).post(url("seat", private_table), {}, format="json").status_code == 404
    for _ in range(2):
        response = registered_client.post(url("invitations", private_table), {"user_id": friend.pk}, format="json")
        assert response.status_code == 200
        assert response.data["results"] == [{"id": friend.pk, "username": friend.username}]
    assert TableInvitation.objects.filter(table=private_table).count() == 1
    invited = client_for(friend)
    assert invited.get(url("detail", private_table)).status_code == 200
    assert invited.get(reverse("tables:private")).data["results"][0]["id"] == private_table.pk
    joined = invited.post(url("seat", private_table), {}, format="json")
    assert joined.status_code == 200 and joined.data["chip_balance"] == 900
    assert registered_client.delete(url("invitations", private_table), {"user_id": friend.pk}, format="json").status_code == 409
    assert invited.delete(url("seat", private_table), {}, format="json").status_code == 200
    assert registered_client.delete(url("invitations", private_table), {"user_id": friend.pk}, format="json").status_code == 200
    assert invited.get(url("detail", private_table)).status_code == 404
    assert invited.get(url("watch", private_table)).status_code == 404
    assert invited.get(reverse("tables:private")).data["results"] == []


def test_private_access_and_host_actions_are_denied_to_others(private_table, registered_client, friend, guest_client):
    """Anonymous, guest and uninvited accounts cannot inspect or manage private tables."""
    for client in [APIClient(), guest_client, client_for(friend)]:
        assert client.get(url("detail", private_table)).status_code == 404
        assert client.get(url("watch", private_table)).status_code == 404
        assert client.get(url("invitations", private_table)).status_code in [403, 404]
    assert registered_client.get(url("detail", private_table)).status_code == 200
    assert "no-store" in registered_client.get(url("detail", private_table))["Cache-Control"]
    for client in [APIClient(), guest_client]:
        assert client.get(reverse("tables:private")).status_code == 403
        assert client.post(reverse("tables:private"), {}, format="json").status_code == 403
    no_csrf = APIClient(enforce_csrf_checks=True)
    no_csrf.force_login(private_table.host)
    assert no_csrf.post(url("invitations", private_table), {"user_id": friend.pk}, format="json").status_code == 403
    assert no_csrf.post(reverse("tables:private"), {}, format="json").status_code == 403


@pytest.mark.parametrize("body", [{}, {"user_id": True}, {"user_id": 0}, {"user_id": "bad"}, {"user_id": 1, "host": 3}])
def test_invite_input_validation(private_table, registered_client, body):
    """Reject malformed and spoofed invite requests before granting access."""
    assert registered_client.post(url("invitations", private_table), body, format="json").status_code == 400
    assert not TableInvitation.objects.exists()


def test_invites_require_accepted_friend_and_active_account(private_table, registered_client, friend):
    """Pending relationships and inactive accounts do not qualify for an invitation."""
    Friendship.objects.all().update(status="pending")
    assert registered_client.post(url("invitations", private_table), {"user_id": friend.pk}, format="json").status_code == 400
    friend.is_active = False
    friend.save(update_fields=["is_active"])
    assert registered_client.post(url("invitations", private_table), {"user_id": friend.pk}, format="json").status_code == 404


def test_spectator_snapshot_is_read_only_and_has_only_public_fields(private_table, registered_client, registered_user):
    """Spectator reads cannot grant seats, expose wallet data or extend table activity."""
    private_table.is_public = True
    private_table.save(update_fields=["is_public"])
    TableSeat.objects.create(table=private_table, user=registered_user, buy_in=100, stack=100)
    before = private_table.last_activity_at
    wallet = registered_user.chip_balance
    client = APIClient()
    response = client.get(url("watch", private_table))
    assert response.status_code == 200 and "no-store" in response["Cache-Control"]
    assert set(response.data) == {"id", "name", "status", "is_public", "host", "max_players", "small_blind", "big_blind", "players", "gameplay_available"}
    assert response.data["players"] == [{"id": registered_user.pk, "username": registered_user.username, "stack": 100}]
    assert response.data["gameplay_available"] is False
    assert client.post(url("watch", private_table), {}, format="json").status_code == 405
    assert client.delete(url("watch", private_table)).status_code == 405
    private_table.refresh_from_db(); registered_user.refresh_from_db()
    assert private_table.last_activity_at == before and private_table.player_count == 0
    assert registered_user.chip_balance == wallet and TableSeat.objects.count() == 1


def test_buy_in_range_filters_combine_and_reject_inverted_range(private_table):
    """S11 filters enforce inclusive bounds and never disclose matching private tables."""
    host = private_table.host
    for amount in [50, 100, 200]:
        PokerTable.objects.create(host=host, name=f"Public {amount}", max_players=2,
            buy_in=amount, minimum_balance=amount, small_blind=5, big_blind=10)
    response = APIClient().get(reverse("tables:create"), {"min_buy_in": 100, "max_buy_in": 150, "available_seats": "true", "max_players": 2})
    assert response.status_code == 200 and [row["buy_in"] for row in response.data["results"]] == [100]
    assert APIClient().get(reverse("tables:create"), {"min_buy_in": 200, "max_buy_in": 100}).status_code == 400
