import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from progression.models import Event
from progression.services import record_event

pytestmark = pytest.mark.django_db
URL = "/api/leaderboard/"


def account(name, xp=0, active=True):
    user = get_user_model().objects.create_user(username=name, email=f"{name}@example.com", is_active=active)
    if xp:
        Event.objects.create(user=user, kind="game", source="test-fixture", xp=xp)
    return user


def test_real_xp_order_ties_and_zero_players():
    first = account("first", 100)
    second = account("second", 100)
    third = account("third", 50)
    last = account("zero")
    account("inactive", 9999, False)
    response = APIClient().get(URL)
    assert response.status_code == 200
    assert [r["id"] for r in response.data["results"]] == [first.pk, second.pk, third.pk, last.pk]
    assert [r["rank"] for r in response.data["results"]] == [1, 1, 3, 4]
    assert [r["total_xp"] for r in response.data["results"]] == [100, 100, 50, 0]
    assert response.data["count"] == 4
    assert response.data["current_user"] is None
    assert "no-store" in response["Cache-Control"]


def test_empty_leaderboard():
    response = APIClient().get(URL)
    assert response.status_code == 200
    assert response.data["results"] == []
    assert response.data["count"] == 0
    assert response.data["total_pages"] == 1


def test_current_user_rank_outside_requested_page(registered_client, registered_user):
    for i in range(3):
        account(f"leader{i}", 100)
    record_event(registered_user.pk, "avatar", "real-action")
    response = registered_client.get(URL + "?page_size=1&page=2")
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["rank"] == 1
    assert response.data["current_user"]["rank"] == 4
    assert response.data["current_user"]["total_xp"] == 50
    assert response.data["current_user"]["id"] == registered_user.pk
    assert response.data["current_user"]["is_current_user"]
    assert "email" not in str(response.data)
    assert "@example.com" not in str(response.data)


def test_guest_is_public_view(guest_client):
    account("visible", 100)
    response = guest_client.get(URL)
    assert response.status_code == 200
    assert response.data["current_user"] is None
    assert not response.data["results"][0]["is_current_user"]


def test_rank_changes_only_after_real_ledger_changes(registered_user, registered_client):
    account("rival", 25)
    assert registered_client.get(URL).data["current_user"]["rank"] == 2
    record_event(registered_user.pk, "game", "new-game")
    result = registered_client.get(URL).data
    assert result["results"][0]["id"] == registered_user.pk
    assert result["current_user"]["rank"] == 1
    assert result["current_user"]["total_xp"] == 50
    record_event(registered_user.pk, "game", "new-game")
    assert registered_client.get(URL).data["current_user"]["total_xp"] == 50


@pytest.mark.parametrize("query", ["page=0", "page=-1", "page=x", "page=1.5", "page=2147483648", "page_size=0", "page_size=51", "page_size=x", "page=1&page=2", "sort=email", "user_id=1", "period=season"])
def test_invalid_queries(query):
    assert APIClient().get(URL + "?" + query).status_code == 400


def test_unknown_page_is_404():
    assert APIClient().get(URL + "?page=2").status_code == 404


def test_public_payload_only_and_avatar(registered_user):
    registered_user.avatar = "avatars/generated.webp"
    registered_user.save(update_fields=["avatar"])
    row = APIClient().get(URL).data["results"][0]
    assert set(row) == {"id", "username", "rank", "avatar_url", "total_xp", "is_current_user"}
    assert row["avatar_url"] == "/media/avatars/generated.webp"
    assert "password" not in row
    assert APIClient().post(URL, {"total_xp": 9999}, format="json").status_code == 405


def test_page_boundary_preserves_tied_global_rank():
    for i in range(5):
        account(f"tie{i}", 50)
    client = APIClient()
    one = client.get(URL + "?page_size=2&page=1").data
    two = client.get(URL + "?page_size=2&page=2").data
    assert one["results"][0]["rank"] == two["results"][0]["rank"] == 1
    assert {r["id"] for r in one["results"]}.isdisjoint(r["id"] for r in two["results"])
    assert two["page"] == 2
    assert two["total_pages"] == 3


def test_query_count_does_not_grow_per_player(django_assert_num_queries):
    for i in range(15):
        account(f"query{i}", i)
    with django_assert_num_queries(2):
        response = APIClient().get(URL)
    assert len(response.data["results"]) == 10


def test_deactivation_after_authentication_omits_personal_rank(registered_user):
    # Middleware may have cached the active user just before another request deactivates it.
    client = APIClient()
    client.force_authenticate(registered_user)
    get_user_model().objects.filter(pk=registered_user.pk).update(is_active=False)
    response = client.get(URL)
    assert response.status_code == 200
    assert response.data["current_user"] is None
    assert response.data["results"] == []
