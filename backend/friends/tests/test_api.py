import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from conftest import TEST_PASSWORD, csrf_client, sign_in
from friends import services
from friends.models import Friendship

pytestmark = pytest.mark.django_db

LIST = reverse("friends:list")
SEND = reverse("friends:send")


def make_player(username, **extra):
    return get_user_model().objects.create_user(
        username=username, email=f"{username}@example.com", password=TEST_PASSWORD, **extra
    )


def action(name, pk):
    return reverse(f"friends:{name}", args=[pk])


def usernames(entries):
    return [entry["player"]["username"] for entry in entries]


@pytest.fixture
def alice():
    return make_player("alice")


@pytest.fixture
def bob():
    return make_player("bob")


@pytest.fixture
def alice_client(alice):
    return sign_in("alice")


@pytest.fixture
def bob_client(bob):
    return sign_in("bob")


@pytest.fixture
def pending(alice, bob):
    return Friendship.objects.create(from_user=alice, to_user=bob)


@pytest.fixture
def friendship(alice, bob):
    return Friendship.objects.create(from_user=alice, to_user=bob, status=Friendship.Status.ACCEPTED)


# Listing


def test_new_player_has_empty_lists(alice_client):
    response = alice_client.get(LIST)
    assert response.status_code == 200
    assert response.data["friends"] == response.data["incoming"] == response.data["outgoing"] == []
    assert response.data["csrf_token"]


def test_lists_split_friends_incoming_and_outgoing(alice, alice_client):
    carol, dave, erin = make_player("carol"), make_player("Dave"), make_player("erin")
    Friendship.objects.create(from_user=alice, to_user=dave, status=Friendship.Status.ACCEPTED)
    Friendship.objects.create(from_user=carol, to_user=alice, status=Friendship.Status.ACCEPTED)
    Friendship.objects.create(from_user=erin, to_user=alice)
    make_player("stranger")
    data = alice_client.get(LIST).data
    assert usernames(data["friends"]) == ["carol", "Dave"]
    assert usernames(data["incoming"]) == ["erin"]
    assert data["outgoing"] == []


def test_lists_expose_only_public_player_fields(pending, alice_client):
    entry = alice_client.get(LIST).data["outgoing"][0]
    assert entry["player"] == {"id": pending.to_user_id, "username": "bob"}
    assert set(entry) == {"id", "player", "created_at"}


# Sending requests


def test_send_request_creates_pending_request(alice_client, bob_client):
    response = alice_client.post(SEND, {"username": "bob"}, format="json")
    assert response.status_code == 201
    assert usernames(response.data["outgoing"]) == ["bob"]
    assert usernames(bob_client.get(LIST).data["incoming"]) == ["alice"]


def test_username_lookup_ignores_case(bob, alice_client):
    response = alice_client.post(SEND, {"username": "BOB"}, format="json")
    assert response.status_code == 201


@pytest.mark.parametrize(
    "body, field",
    [
        ({"username": "nobody"}, "username"),
        ({}, "username"),
        ({"username": ""}, "username"),
        ({"username": "bob", "status": "accepted"}, "status"),
    ],
)
def test_invalid_request_bodies_are_rejected(bob, alice_client, body, field):
    response = alice_client.post(SEND, body, format="json")
    assert response.status_code == 400
    assert field in response.data
    assert not Friendship.objects.exists()


def test_inactive_player_cannot_be_found(alice_client):
    make_player("gone", is_active=False)
    response = alice_client.post(SEND, {"username": "gone"}, format="json")
    assert response.status_code == 400
    assert "username" in response.data


def test_cannot_request_yourself(alice_client):
    response = alice_client.post(SEND, {"username": "alice"}, format="json")
    assert response.status_code == 400
    assert response.data["non_field_errors"] == ["You can't add yourself as a friend."]


def test_duplicate_request_is_rejected(pending, alice_client):
    response = alice_client.post(SEND, {"username": "bob"}, format="json")
    assert response.status_code == 400
    assert response.data["non_field_errors"] == ["You already sent bob a friend request."]
    assert Friendship.objects.count() == 1


def test_request_to_existing_friend_is_rejected(friendship, bob_client):
    response = bob_client.post(SEND, {"username": "alice"}, format="json")
    assert response.status_code == 400
    assert response.data["non_field_errors"] == ["You're already friends with alice."]


def test_crossed_request_accepts_the_existing_one(pending, bob_client):
    # Alice already asked Bob, so Bob asking Alice makes them friends.
    response = bob_client.post(SEND, {"username": "alice"}, format="json")
    assert response.status_code == 200
    assert usernames(response.data["friends"]) == ["alice"]
    assert response.data["incoming"] == []
    pending.refresh_from_db()
    assert pending.status == Friendship.Status.ACCEPTED
    assert Friendship.objects.count() == 1


def test_simultaneous_crossed_requests_become_friends(pending, bob_client, monkeypatch):
    # Simulate Alice's request committing after Bob's check found nothing.
    real_locked_pair = services.locked_pair
    calls = []

    def first_check_misses(user, other):
        calls.append(user)
        return None if len(calls) == 1 else real_locked_pair(user, other)

    monkeypatch.setattr(services, "locked_pair", first_check_misses)
    response = bob_client.post(SEND, {"username": "alice"}, format="json")
    assert response.status_code == 200
    assert usernames(response.data["friends"]) == ["alice"]
    assert Friendship.objects.count() == 1


def test_simultaneous_duplicate_requests_return_400(pending, alice_client, monkeypatch):
    # A double-click: the first request commits after the second one's check.
    real_locked_pair = services.locked_pair
    calls = []

    def first_check_misses(user, other):
        calls.append(user)
        return None if len(calls) == 1 else real_locked_pair(user, other)

    monkeypatch.setattr(services, "locked_pair", first_check_misses)
    response = alice_client.post(SEND, {"username": "bob"}, format="json")
    assert response.status_code == 400
    assert Friendship.objects.count() == 1


# Accepting, declining, cancelling


def test_receiver_accepts_request(pending, alice_client, bob_client):
    response = bob_client.post(action("accept", pending.pk), {}, format="json")
    assert response.status_code == 200
    assert usernames(response.data["friends"]) == ["alice"]
    assert usernames(alice_client.get(LIST).data["friends"]) == ["bob"]


def test_sender_cannot_accept_own_request(pending, alice_client):
    response = alice_client.post(action("accept", pending.pk), {}, format="json")
    assert response.status_code == 404
    pending.refresh_from_db()
    assert pending.status == Friendship.Status.PENDING


def test_accepted_request_cannot_be_accepted_again(friendship, bob_client):
    assert bob_client.post(action("accept", friendship.pk), {}, format="json").status_code == 404


def test_actions_accept_only_an_empty_body(pending, bob_client):
    response = bob_client.post(action("accept", pending.pk), {"status": "accepted"}, format="json")
    assert response.status_code == 400
    pending.refresh_from_db()
    assert pending.status == Friendship.Status.PENDING


def test_receiver_declines_and_sender_may_ask_again(pending, alice_client, bob_client):
    response = bob_client.post(action("decline", pending.pk), {}, format="json")
    assert response.status_code == 200
    assert response.data["incoming"] == []
    assert not Friendship.objects.exists()
    assert alice_client.post(SEND, {"username": "bob"}, format="json").status_code == 201


def test_sender_cannot_decline(pending, alice_client):
    assert alice_client.post(action("decline", pending.pk), {}, format="json").status_code == 404
    assert Friendship.objects.exists()


def test_sender_cancels_request(pending, alice_client):
    response = alice_client.post(action("cancel", pending.pk), {}, format="json")
    assert response.status_code == 200
    assert response.data["outgoing"] == []
    assert not Friendship.objects.exists()


def test_receiver_cannot_cancel(pending, bob_client):
    assert bob_client.post(action("cancel", pending.pk), {}, format="json").status_code == 404
    assert Friendship.objects.exists()


def test_missing_request_is_404(alice_client):
    assert alice_client.post(action("accept", 999), {}, format="json").status_code == 404


# Removing friends


@pytest.mark.parametrize("remover", ["alice_client", "bob_client"])
def test_either_friend_can_remove(friendship, remover, request):
    client = request.getfixturevalue(remover)
    response = client.delete(action("remove", friendship.pk))
    assert response.status_code == 200
    assert response.data["friends"] == []
    assert not Friendship.objects.exists()


def test_remove_does_not_touch_pending_requests(pending, alice_client):
    assert alice_client.delete(action("remove", pending.pk)).status_code == 404
    assert Friendship.objects.exists()


def test_outsider_cannot_remove_a_friendship(friendship):
    make_player("carol")
    response = sign_in("carol").delete(action("remove", friendship.pk))
    assert response.status_code == 404
    assert Friendship.objects.exists()


# Permissions and CSRF


def all_endpoints(pk):
    return [
        ("get", LIST, None),
        ("post", SEND, {"username": "bob"}),
        ("post", action("accept", pk), {}),
        ("post", action("decline", pk), {}),
        ("post", action("cancel", pk), {}),
        ("delete", action("remove", pk), None),
    ]


@pytest.mark.parametrize("index", range(6))
def test_anonymous_visitors_are_refused(pending, index):
    method, url, body = all_endpoints(pending.pk)[index]
    response = getattr(csrf_client(), method)(url, body, format="json")
    assert response.status_code == 403
    assert Friendship.objects.get(pk=pending.pk).status == Friendship.Status.PENDING


@pytest.mark.parametrize("index", range(6))
def test_guests_are_refused(pending, guest_client, index):
    method, url, body = all_endpoints(pending.pk)[index]
    response = getattr(guest_client, method)(url, body, format="json")
    assert response.status_code == 403
    assert Friendship.objects.get(pk=pending.pk).status == Friendship.Status.PENDING


def test_writes_require_csrf_token(pending, bob):
    client = APIClient(enforce_csrf_checks=True)
    client.login(username="bob", password=TEST_PASSWORD)
    response = client.post(action("accept", pending.pk), {}, format="json")
    assert response.status_code == 403
    pending.refresh_from_db()
    assert pending.status == Friendship.Status.PENDING


def test_wrong_method_is_rejected(alice_client):
    assert alice_client.delete(LIST).status_code == 405


def test_search_players_matches_case_insensitively_and_limits_to_five(alice_client, alice):
    User = get_user_model()
    for i in range(7):
        User.objects.create(username=f"Match{i}", email=f"match{i}@example.com")
    User.objects.create(username="MatchInactive", is_active=False)
    response = alice_client.get(reverse("friends:search"), {"q": "mAtCh"})
    assert response.status_code == 200
    assert [row["username"] for row in response.data["results"]] == [f"Match{i}" for i in range(5)]
    assert all(set(row) == {"id", "username"} for row in response.data["results"])
    assert alice_client.get(reverse("friends:search"), {"q": "alice"}).data == {"results": []}
    assert alice_client.get(reverse("friends:search"), {"q": "  "}).data == {"results": []}
    assert alice_client.get(reverse("friends:search"), {"q": "no-match"}).data == {"results": []}


@pytest.mark.parametrize("query", ["?q=a&q=b", "?other=x", "?q=" + "a" * 151])
def test_search_players_rejects_invalid_queries(alice_client, query):
    assert alice_client.get(reverse("friends:search") + query).status_code == 400


def test_search_players_requires_registered_account(guest_client):
    assert APIClient().get(reverse("friends:search"), {"q": "a"}).status_code == 403
    assert guest_client.get(reverse("friends:search"), {"q": "a"}).status_code == 403
