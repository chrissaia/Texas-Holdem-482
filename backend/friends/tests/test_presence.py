"""S20: players can see which friends are online or at a table."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from conftest import TEST_PASSWORD, sign_in
from friends.models import Friendship, Presence
from friends.presence import ONLINE_WINDOW, TOUCH_INTERVAL, presence_for, touch
from tables.models import PokerTable, TableInvitation, TableSeat

pytestmark = pytest.mark.django_db

LIST = reverse("friends:list")
ONLINE = reverse("friends:online")


def make_player(username):
    return get_user_model().objects.create_user(
        username=username, email=f"{username}@example.com", password=TEST_PASSWORD
    )


def befriend(a, b, status="accepted"):
    return Friendship.objects.create(from_user=a, to_user=b, status=status)


def seen(user, ago):
    Presence.objects.update_or_create(user=user, defaults={"last_seen_at": timezone.now() - ago})


def seat(user, table):
    TableSeat.objects.create(user=user, table=table, buy_in=table.buy_in, stack=table.buy_in)


def make_table(host, **extra):
    values = dict(name="Blue Hour", host=host, max_players=6, buy_in=100, minimum_balance=100,
                  small_blind=5, big_blind=10, player_count=1)
    return PokerTable.objects.create(**(values | extra))


def presence_of(client, username):
    friends = client.get(LIST).data["friends"]
    return next(f["presence"] for f in friends if f["player"]["username"] == username)


@pytest.fixture
def mira(registered_user):
    friend = make_player("mira")
    befriend(registered_user, friend)
    return friend


def test_friend_who_never_signed_in_is_offline(registered_client, mira):
    response = registered_client.get(LIST)
    assert response.data["online_count"] == 0
    assert presence_of(registered_client, "mira") == {"status": "offline", "table": None}


def test_signing_in_shows_friend_online_and_logout_shows_offline(registered_client, mira):
    client = sign_in("mira")
    assert presence_of(registered_client, "mira")["status"] == "online"
    assert registered_client.get(ONLINE).data == {"online_count": 1}

    client.post(reverse("accounts:logout"), {}, format="json")
    assert presence_of(registered_client, "mira")["status"] == "offline"
    assert registered_client.get(ONLINE).data == {"online_count": 0}


def test_presence_expires_after_the_online_window(registered_client, mira):
    seen(mira, ONLINE_WINDOW - timedelta(seconds=5))
    assert presence_of(registered_client, "mira")["status"] == "online"
    seen(mira, ONLINE_WINDOW + timedelta(seconds=5))
    assert presence_of(registered_client, "mira")["status"] == "offline"


def test_any_api_request_keeps_a_player_online(mira):
    client = APIClient()
    client.force_login(mira)
    Presence.objects.all().delete()  # clear the login signal's mark; only the middleware can restore it
    client.get(reverse("tables:create"))
    assert Presence.objects.filter(user=mira).exists()


def test_non_api_requests_and_guests_do_not_mark_presence(mira, guest_client):
    client = APIClient()
    client.force_login(mira)
    Presence.objects.all().delete()
    client.get("/admin/login/")
    assert not Presence.objects.exists()
    guest_client.get(reverse("tables:create"))
    assert not Presence.objects.exists()


def test_touch_writes_at_most_once_per_interval(mira):
    start = timezone.now()
    touch(mira, start)
    touch(mira, start + TOUCH_INTERVAL - timedelta(seconds=1))
    assert Presence.objects.get(user=mira).last_seen_at == start
    later = start + TOUCH_INTERVAL + timedelta(seconds=1)
    touch(mira, later)
    assert Presence.objects.get(user=mira).last_seen_at == later


def test_friend_at_a_public_table_shows_the_table(registered_client, registered_user, mira):
    table = make_table(registered_user)
    seat(mira, table)
    seen(mira, timedelta(seconds=10))
    assert presence_of(registered_client, "mira") == {
        "status": "at_table",
        "table": {"id": table.pk, "name": "Blue Hour", "player_count": 1, "max_players": 6, "status": "waiting"},
    }
    assert registered_client.get(LIST).data["online_count"] == 1


def test_seated_but_offline_friend_is_offline(registered_client, registered_user, mira):
    seat(mira, make_table(registered_user))
    seen(mira, ONLINE_WINDOW + timedelta(minutes=1))
    assert presence_of(registered_client, "mira") == {"status": "offline", "table": None}


def test_private_table_is_hidden_unless_the_viewer_can_see_it(registered_client, registered_user, mira):
    host = make_player("private-host")
    table = make_table(host, name="Secret game", is_public=False)
    seat(mira, table)
    seen(mira, timedelta(seconds=10))
    # Not invited: the friend looks merely online and the table stays hidden.
    assert presence_of(registered_client, "mira") == {"status": "online", "table": None}

    TableInvitation.objects.create(table=table, user=registered_user)
    assert presence_of(registered_client, "mira")["table"]["name"] == "Secret game"


def test_pending_requests_and_strangers_never_expose_presence(registered_client, registered_user):
    eli = make_player("eli")
    stranger = make_player("stranger")
    befriend(eli, registered_user, status="pending")
    seen(eli, timedelta(seconds=5))
    seen(stranger, timedelta(seconds=5))
    data = registered_client.get(LIST).data
    assert data["online_count"] == 0
    assert "presence" not in data["incoming"][0]
    assert data["friends"] == []


def test_presence_for_returns_every_requested_user(registered_user, mira):
    other = make_player("other")
    seen(mira, timedelta(seconds=1))
    result = presence_for(registered_user, [mira, other])
    assert result == {mira.pk: {"status": "online", "table": None}, other.pk: {"status": "offline", "table": None}}


def test_online_endpoint_is_registered_only(guest_client):
    assert APIClient().get(ONLINE).status_code == 403
    assert guest_client.get(ONLINE).status_code == 403


def test_online_endpoint_is_get_only_and_uncached(registered_client):
    response = registered_client.get(ONLINE)
    assert "no-cache" in response["Cache-Control"] or "no-store" in response["Cache-Control"]
    assert registered_client.post(ONLINE, {}, format="json").status_code == 405


def test_deleting_an_account_removes_its_presence(mira):
    touch(mira)
    mira.delete()
    assert not Presence.objects.exists()


def test_presence_reads_clearly_in_the_admin(mira):
    touch(mira, timezone.make_aware(timezone.datetime(2026, 11, 18, 20, 12)))
    assert str(Presence.objects.get(user=mira)) == "mira seen 2026-11-18 20:12"
