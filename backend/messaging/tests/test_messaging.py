"""S21: players can message friends and use table chat."""
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from conftest import TEST_PASSWORD, sign_in
from friends.models import Friendship
from messaging.models import DirectMessage, TableMessage
from messaging.services import FIRST_MESSAGE_SOURCE, PAGE_SIZE, RATE_LIMIT
from progression.models import Achievement, Event
from tables.models import PokerTable, TableInvitation, TableSeat

pytestmark = pytest.mark.django_db

LIST = reverse("messaging:conversations")


def make_player(username):
    return get_user_model().objects.create_user(
        username=username, email=f"{username}@example.com", password=TEST_PASSWORD
    )


def befriend(a, b, status="accepted"):
    return Friendship.objects.create(from_user=a, to_user=b, status=status)


def dm_url(user):
    return reverse("messaging:conversation", args=[user.pk])


def chat_url(table):
    return reverse("messaging:table-chat", args=[table.pk])


def send(client, url, body="Hey!"):
    return client.post(url, {"body": body}, format="json")


@pytest.fixture
def mira(registered_user):
    friend = make_player("mira")
    befriend(registered_user, friend)
    return friend


@pytest.fixture
def mira_client(mira):
    return sign_in("mira")


# Direct messages


def test_friends_can_message_each_other(registered_client, registered_user, mira, mira_client):
    sent = send(registered_client, dm_url(mira), "  Good game!  ")
    assert sent.status_code == 201
    assert sent.data["message"]["body"] == "Good game!"
    assert sent.data["message"]["sender"] == {"id": registered_user.pk, "username": "registered-player"}
    assert sent.data["message"]["read"] is False
    assert sent.data["csrf_token"]

    thread = mira_client.get(dm_url(registered_user))
    assert thread.status_code == 200
    assert thread.data["friend"] == {"id": registered_user.pk, "username": "registered-player"}
    assert thread.data["presence"]["status"] == "online"
    assert [m["body"] for m in thread.data["messages"]] == ["Good game!"]
    assert "email" not in str(thread.data)

    send(mira_client, dm_url(registered_user), "Want to play?")
    bodies = [m["body"] for m in registered_client.get(dm_url(mira)).data["messages"]]
    assert bodies == ["Good game!", "Want to play?"]


def test_opening_a_conversation_marks_messages_read(registered_client, registered_user, mira, mira_client):
    send(registered_client, dm_url(mira))
    assert registered_client.get(dm_url(mira)).data["messages"][0]["read"] is False
    mira_client.get(dm_url(registered_user))
    assert DirectMessage.objects.get().read_at is not None
    assert registered_client.get(dm_url(mira)).data["messages"][0]["read"] is True


def test_conversation_list_orders_by_latest_and_counts_unread(registered_client, registered_user, mira):
    theo = make_player("theo")
    befriend(theo, registered_user)
    jun = make_player("jun")
    befriend(registered_user, jun)
    DirectMessage.objects.create(sender=mira, recipient=registered_user, body="old")
    DirectMessage.objects.create(sender=theo, recipient=registered_user, body="one")
    DirectMessage.objects.create(sender=theo, recipient=registered_user, body="more orbit?")

    data = registered_client.get(LIST).data
    names = [row["friend"]["username"] for row in data["conversations"]]
    assert names == ["theo", "mira", "jun"]  # newest first, then friends with no messages
    theo_row = data["conversations"][0]
    assert theo_row["last_message"]["body"] == "more orbit?"
    assert theo_row["unread_count"] == 2
    assert data["conversations"][2]["last_message"] is None
    assert data["unread_count"] == 3

    registered_client.get(dm_url(theo))
    assert registered_client.get(LIST).data["unread_count"] == 1


def test_polling_returns_only_newer_messages(registered_client, registered_user, mira):
    first = DirectMessage.objects.create(sender=mira, recipient=registered_user, body="one")
    DirectMessage.objects.create(sender=mira, recipient=registered_user, body="two")
    response = registered_client.get(dm_url(mira), {"after": first.pk})
    assert [m["body"] for m in response.data["messages"]] == ["two"]


def test_long_history_returns_the_latest_page_in_order(registered_client, registered_user, mira):
    DirectMessage.objects.bulk_create(
        DirectMessage(sender=mira, recipient=registered_user, body=str(i)) for i in range(PAGE_SIZE + 5)
    )
    bodies = [m["body"] for m in registered_client.get(dm_url(mira)).data["messages"]]
    assert len(bodies) == PAGE_SIZE
    assert bodies[0] == "5" and bodies[-1] == str(PAGE_SIZE + 4)


@pytest.mark.parametrize("status", ["pending", None])
def test_only_accepted_friends_can_message(registered_client, registered_user, status):
    other = make_player("not-a-friend")
    if status:
        befriend(registered_user, other, status=status)
    assert send(registered_client, dm_url(other)).status_code == 404
    assert registered_client.get(dm_url(other)).status_code == 404
    assert registered_client.get(reverse("messaging:conversation", args=[987654])).status_code == 404
    assert not DirectMessage.objects.exists()


def test_removing_a_friend_ends_the_conversation(registered_client, registered_user, mira):
    send(registered_client, dm_url(mira))
    Friendship.objects.all().delete()
    assert registered_client.get(dm_url(mira)).status_code == 404
    assert send(registered_client, dm_url(mira)).status_code == 404
    assert registered_client.get(LIST).data["conversations"] == []


def test_another_players_conversation_is_not_readable(mira, registered_user):
    eve = make_player("eve")
    befriend(eve, mira)
    DirectMessage.objects.create(sender=mira, recipient=registered_user, body="private")
    thread = sign_in("eve").get(dm_url(mira)).data["messages"]
    assert thread == []


@pytest.mark.parametrize("body", [
    {"body": ""}, {"body": "   "}, {"body": "x" * 501}, {}, {"body": "hi", "sender": 1}, [],
])
def test_invalid_message_bodies_are_refused(registered_client, mira, body):
    assert registered_client.post(dm_url(mira), body, format="json").status_code == 400
    assert not DirectMessage.objects.exists()


def test_exactly_500_characters_is_allowed(registered_client, mira):
    assert send(registered_client, dm_url(mira), "x" * 500).status_code == 201


@pytest.mark.parametrize("query", [{"after": "abc"}, {"after": "-1"}, {"page": "2"}])
def test_invalid_polling_parameters_are_refused(registered_client, mira, query):
    assert registered_client.get(dm_url(mira), query).status_code == 400


def test_conversation_list_takes_no_parameters(registered_client):
    assert registered_client.get(LIST, {"x": "1"}).status_code == 400


def test_sending_too_fast_is_rate_limited(registered_client, mira):
    for _ in range(RATE_LIMIT):
        assert send(registered_client, dm_url(mira)).status_code == 201
    refused = send(registered_client, dm_url(mira))
    assert refused.status_code == 429
    assert "too quickly" in refused.data["non_field_errors"][0]
    DirectMessage.objects.update(created_at=timezone.now() - timedelta(seconds=11))
    assert send(registered_client, dm_url(mira)).status_code == 201


def test_first_message_earns_say_hello_once(registered_client, registered_user, mira):
    send(registered_client, dm_url(mira))
    send(registered_client, dm_url(mira))
    assert Achievement.objects.filter(user=registered_user, code="message").count() == 1
    assert Event.objects.filter(user=registered_user, kind="message", source=FIRST_MESSAGE_SOURCE).count() == 1


def test_messages_require_a_registered_session_and_csrf(guest_client, registered_user, mira):
    assert APIClient().get(LIST).status_code == 403
    assert guest_client.get(LIST).status_code == 403
    assert guest_client.post(dm_url(mira), {"body": "hi"}, format="json").status_code == 403
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(registered_user)
    assert send(client, dm_url(mira)).status_code == 403
    assert not DirectMessage.objects.exists()


def test_unsupported_methods(registered_client, mira):
    assert registered_client.delete(dm_url(mira)).status_code == 405
    assert registered_client.post(LIST, {}, format="json").status_code == 405


def test_deleting_an_account_deletes_its_messages(registered_client, mira):
    send(registered_client, dm_url(mira))
    mira.delete()
    assert not DirectMessage.objects.exists()


# Table chat


def make_table(host, **extra):
    values = dict(name="Blue Hour", host=host, max_players=6, buy_in=100, minimum_balance=100,
                  small_blind=5, big_blind=10)
    return PokerTable.objects.create(**(values | extra))


def sit(user, table):
    TableSeat.objects.create(user=user, table=table, buy_in=table.buy_in, stack=table.buy_in)
    PokerTable.objects.filter(pk=table.pk).update(player_count=table.seats.count())


def test_seated_players_chat_and_anyone_who_can_see_the_table_reads(registered_client, registered_user, mira, mira_client):
    table = make_table(registered_user)
    sit(registered_user, table)
    sent = send(registered_client, chat_url(table), "Nice hand!")
    assert sent.status_code == 201
    assert sent.data["message"]["body"] == "Nice hand!"

    watcher = sign_in(make_player("watcher").username)
    chat = watcher.get(chat_url(table)).data
    assert chat["can_post"] is False
    assert chat["player_count"] == 1
    assert [m["body"] for m in chat["messages"]] == ["Nice hand!"]
    refused = send(watcher, chat_url(table), "let me in")
    assert refused.status_code == 403
    assert refused.data == {"non_field_errors": ["Take a seat at this table to join the chat."]}

    sit(mira, table)
    assert mira_client.get(chat_url(table)).data["can_post"] is True
    send(mira_client, chat_url(table), "GG")
    bodies = [m["body"] for m in registered_client.get(chat_url(table)).data["messages"]]
    assert bodies == ["Nice hand!", "GG"]


def test_chat_is_separate_for_each_table(registered_client, registered_user):
    first, second = make_table(registered_user), make_table(registered_user, name="Night Shift")
    sit(registered_user, first)
    send(registered_client, chat_url(first), "only here")
    assert registered_client.get(chat_url(second)).data["messages"] == []


def test_private_table_chat_is_hidden_from_uninvited_players(registered_client, registered_user):
    host = make_player("private-host")
    table = make_table(host, is_public=False)
    TableMessage.objects.create(table=table, sender=host, body="secret")
    assert registered_client.get(chat_url(table)).status_code == 404
    assert send(registered_client, chat_url(table)).status_code == 404
    TableInvitation.objects.create(table=table, user=registered_user)
    assert [m["body"] for m in registered_client.get(chat_url(table)).data["messages"]] == ["secret"]


def test_table_chat_polling_and_validation(registered_client, registered_user):
    table = make_table(registered_user)
    sit(registered_user, table)
    first = send(registered_client, chat_url(table), "one").data["message"]["id"]
    send(registered_client, chat_url(table), "two")
    newer = registered_client.get(chat_url(table), {"after": first}).data["messages"]
    assert [m["body"] for m in newer] == ["two"]
    assert registered_client.post(chat_url(table), {"body": ""}, format="json").status_code == 400
    assert registered_client.get(reverse("messaging:table-chat", args=[987654])).status_code == 404


def test_table_chat_is_rate_limited_and_registered_only(registered_client, registered_user, guest_client):
    table = make_table(registered_user)
    sit(registered_user, table)
    for _ in range(RATE_LIMIT):
        send(registered_client, chat_url(table))
    assert send(registered_client, chat_url(table)).status_code == 429
    assert guest_client.get(chat_url(table)).status_code == 403
    assert APIClient().get(chat_url(table)).status_code == 403


def test_message_strings_read_clearly_in_the_admin(registered_user, mira):
    when = timezone.make_aware(timezone.datetime(2026, 11, 20, 20, 42))
    dm = DirectMessage.objects.create(sender=mira, recipient=registered_user, body="hi", created_at=when)
    table = make_table(registered_user)
    chat = TableMessage.objects.create(table=table, sender=mira, body="hi", created_at=when)
    assert str(dm) == "mira → registered-player at 2026-11-20 20:42"
    assert str(chat) == f"mira at table {table.pk} at 2026-11-20 20:42"
