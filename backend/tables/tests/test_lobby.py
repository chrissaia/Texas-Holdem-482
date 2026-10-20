from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from tables.models import PokerTable

pytestmark = pytest.mark.django_db


@pytest.fixture
def lobby():
    user_model = get_user_model()
    mira = user_model.objects.create_user(username="Mira", email="hidden@example.com")
    theo = user_model.objects.create_user(username="Theo")
    settings = dict(max_players=6, buy_in=1000, minimum_balance=1000, small_blind=25, big_blind=50)
    blue = PokerTable.objects.create(name="Blue Hour", host=mira, player_count=4, **settings)
    river = PokerTable.objects.create(
        name="river Room", host=theo, max_players=9, buy_in=400,
        minimum_balance=400, small_blind=10, big_blind=20, player_count=5,
    )
    full = PokerTable.objects.create(name="After Hours", host=theo, player_count=6, **settings)
    playing = PokerTable.objects.create(name="Night Shift", host=mira, status="playing", **settings)
    PokerTable.objects.create(name="Private secret", host=mira, is_public=False, **settings)
    PokerTable.objects.create(name="Closed", host=mira, status="closed", **settings)
    return blue, river, full, playing


def list_tables(**query):
    return APIClient().get(reverse("tables:create"), query)


def ids(response):
    return [row["id"] for row in response.data["results"]]


def test_public_list_hides_private_and_closed_and_uses_real_occupancy(lobby):
    response = list_tables()
    assert response.status_code == 200
    assert response.data["count"] == response.data["total_tables"] == 4
    assert response.data["total_players"] == 15
    assert response.data["page_size"] == 8
    assert set(ids(response)) == {t.pk for t in lobby}
    row = next(row for row in response.data["results"] if row["name"] == "Blue Hour")
    assert row["player_count"] == 4 and row["max_players"] == 6
    assert row["buy_in"] == row["minimum_balance"] == 1000
    assert row["host"] == {"id": lobby[0].host_id, "username": "Mira"}
    assert "hidden@example.com" not in response.content.decode()
    assert "password" not in response.content.decode()


@pytest.mark.parametrize("query,indices", [
    ({"search": "BLUE"}, [0]), ({"search": "theo"}, [1, 2]),
    ({"search": "  night  "}, [3]), ({"max_buy_in": 400}, [1]),
    ({"big_blind": 20}, [1]), ({"max_players": 9}, [1]),
    ({"available_seats": "true"}, [0, 1, 3]),
    ({"available_seats": "false"}, [0, 1, 2, 3]),
    ({"status": "playing"}, [3]), ({"status": "waiting"}, [0, 1, 2]),
    ({"search": "Mira", "max_buy_in": 1000, "big_blind": 50,
      "max_players": 6, "available_seats": "true", "status": "waiting"}, [0]),
    ({"search": "missing"}, []),
])
def test_filters_combine_and_do_not_change_global_totals(lobby, query, indices):
    response = list_tables(**query)
    assert response.status_code == 200
    assert set(ids(response)) == {lobby[i].pk for i in indices}
    assert response.data["total_tables"] == 4
    assert response.data["total_players"] == 15


@pytest.mark.parametrize("ordering,indices", [
    ("name", [2, 0, 3, 1]), ("buy_in", [1, 0, 2, 3]),
    ("-buy_in", [0, 2, 3, 1]), ("blinds", [1, 0, 2, 3]),
    ("players", [2, 1, 0, 3]), ("newest", [3, 2, 1, 0]),
])
def test_sorting_is_deterministic(lobby, ordering, indices):
    # Give created_at values explicit order so the test does not depend on clock precision.
    for i, table in enumerate(lobby):
        PokerTable.objects.filter(pk=table.pk).update(created_at=timezone.now() + timedelta(minutes=i))
    response = list_tables(ordering=ordering)
    assert ids(response) == [lobby[i].pk for i in indices]


def test_pagination_and_page_boundaries(lobby):
    first = list_tables(page_size=2, ordering="name")
    second = list_tables(page_size=2, ordering="name", page=2)
    assert first.data["total_pages"] == 2
    assert first.data["next"] and first.data["previous"] is None
    assert second.data["previous"] and second.data["next"] is None
    assert set(ids(first)).isdisjoint(ids(second))
    assert set(ids(first) + ids(second)) == {t.pk for t in lobby}
    assert list_tables(page_size=2, page=3).status_code == 404


@pytest.mark.parametrize("query", [
    {"ordering": "host__password"}, {"max_buy_in": "abc"}, {"max_buy_in": 0},
    {"max_buy_in": 2147483648}, {"big_blind": -1}, {"max_players": 3},
    {"page": 0}, {"page": "last"}, {"page_size": 51}, {"page_size": 0},
    {"available_seats": "yes"}, {"status": "closed"},
    {"search": "x" * 151}, {"is_public": "false"},
])
def test_invalid_filters_return_clear_errors(query):
    response = list_tables(**query)
    assert response.status_code == 400
    assert set(query).intersection(response.data)


def test_duplicate_filters_are_rejected():
    response = APIClient().get(reverse("tables:create") + "?page=1&page=2")
    assert response.status_code == 400 and "page" in response.data


def test_empty_lobby_and_search_literal_characters(lobby):
    assert list_tables(search="%_' OR 1=1 --").data["results"] == []
    PokerTable.objects.all().delete()
    response = list_tables()
    assert response.data["count"] == response.data["total_tables"] == response.data["total_players"] == 0
    assert response.data["results"] == []
    assert response.data["next"] is None and response.data["previous"] is None


def test_host_queries_do_not_grow_per_table(lobby, django_assert_num_queries):
    # One totals aggregate, one filtered count, and one joined result query.
    with django_assert_num_queries(3):
        response = list_tables()
        assert len(response.data["results"]) == 4


def test_created_table_immediately_appears_in_public_lobby():
    host = get_user_model().objects.create_user(username="creator")
    client = APIClient()
    client.force_authenticate(host)
    created = client.post(reverse("tables:create"), dict(
        name="Fresh table", max_players=6, buy_in=1000,
        minimum_balance=1000, small_blind=25, big_blind=50,
    ), format="json")
    assert created.status_code == 201
    table = PokerTable.objects.get(pk=created.data["id"])
    activity = table.last_activity_at
    response = list_tables(available_seats="true")
    assert ids(response) == [table.pk]
    assert response.data["results"][0] == created.data
    table.refresh_from_db()
    assert table.last_activity_at == activity
