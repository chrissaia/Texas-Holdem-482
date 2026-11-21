"""S21: rules for direct messages and table chat.

Direct messages: only between accepted friends. Opening a conversation marks the friend's
messages as read. A player's first direct message records the "Say Hello" achievement.

Table chat: anyone who may see the table can read it; only players seated there can post.

Both: messages are trimmed, 1–500 characters, and limited to RATE_LIMIT per RATE_WINDOW
for each sender, so a stuck key or script cannot flood a conversation.
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Case, Count, F, Q, When
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from friends.presence import presence_for
from friends.services import ACCEPTED, involving, player
from progression.services import record_event
from tables.access import visible_tables
from tables.models import TableSeat

from .models import DirectMessage, TableMessage

PAGE_SIZE = 50
RATE_LIMIT = 5
RATE_WINDOW = timedelta(seconds=10)
FIRST_MESSAGE_SOURCE = "first-direct-message"


class MessagingError(Exception):
    """A refused send that the player can correct. status is the HTTP code to return."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _friend_or_404(user, friend_id):
    """The accepted friend with this ID. Anyone else is a 404, so non-friends' IDs reveal nothing."""
    row = (
        involving(user)
        .filter(status=ACCEPTED)
        .filter(Q(from_user_id=friend_id) | Q(to_user_id=friend_id))
        .select_related("from_user", "to_user")
        .first()
    )
    if row is None:
        raise Http404
    return row.to_user if row.from_user_id == user.pk else row.from_user


def _check_rate(queryset, now):
    if queryset.filter(created_at__gt=now - RATE_WINDOW).count() >= RATE_LIMIT:
        raise MessagingError("You're sending messages too quickly. Wait a few seconds and try again.", 429)


def _page(queryset, after):
    """Messages after a known ID (for polling), or the latest PAGE_SIZE in time order."""
    if after is not None:
        return list(queryset.filter(id__gt=after).order_by("id")[: PAGE_SIZE * 2])
    return list(reversed(queryset.order_by("-id")[:PAGE_SIZE]))


def direct_message_payload(message):
    return {
        "id": message.id,
        "sender": player(message.sender),
        "body": message.body,
        "created_at": message.created_at,
        "read": message.read_at is not None,
    }


def _between(user, friend):
    return DirectMessage.objects.filter(
        Q(sender=user, recipient=friend) | Q(sender=friend, recipient=user)
    ).select_related("sender")


def conversations(user):
    """Every accepted friend, with the latest message and unread count; most recent first."""
    friends = [
        row.to_user if row.from_user_id == user.pk else row.from_user
        for row in involving(user).filter(status=ACCEPTED).select_related("from_user", "to_user")
    ]
    ids = [friend.pk for friend in friends]
    latest = {
        message.other: message
        for message in DirectMessage.objects.filter(
            Q(sender=user, recipient_id__in=ids) | Q(recipient=user, sender_id__in=ids)
        )
        .annotate(other=Case(When(sender=user, then=F("recipient_id")), default=F("sender_id")))
        .order_by("other", "-id")
        .distinct("other")
        .select_related("sender")
    }
    unread = dict(
        DirectMessage.objects.filter(recipient=user, read_at__isnull=True, sender_id__in=ids)
        .values_list("sender_id")
        .annotate(count=Count("id"))
    )
    statuses = presence_for(user, friends)
    rows = [
        {
            "friend": player(friend),
            "presence": statuses[friend.pk],
            "last_message": direct_message_payload(latest[friend.pk]) if friend.pk in latest else None,
            "unread_count": unread.get(friend.pk, 0),
        }
        for friend in friends
    ]
    # Conversations with messages first (newest first), then friends you haven't messaged, by name.
    rows.sort(key=lambda row: row["friend"]["username"].lower())
    rows.sort(key=lambda row: -row["last_message"]["id"] if row["last_message"] else 0)
    return {"conversations": rows, "unread_count": sum(unread.values())}


def conversation(user, friend_id, after=None):
    """Messages with one friend. Opening it marks that friend's messages to you as read."""
    friend = _friend_or_404(user, friend_id)
    DirectMessage.objects.filter(sender=friend, recipient=user, read_at__isnull=True).update(read_at=timezone.now())
    messages = _page(_between(user, friend), after)
    return {
        "friend": player(friend),
        "presence": presence_for(user, [friend])[friend.pk],
        "messages": [direct_message_payload(message) for message in messages],
    }


@transaction.atomic
def send_direct_message(user, friend_id, body):
    friend = _friend_or_404(user, friend_id)
    now = timezone.now()
    _check_rate(DirectMessage.objects.filter(sender=user), now)
    first = not DirectMessage.objects.filter(sender=user).exists()
    message = DirectMessage.objects.create(sender=user, recipient=friend, body=body, created_at=now)
    if first:
        # Trusted S32 hook: idempotent, so a race between two first messages is harmless.
        record_event(user.pk, "message", FIRST_MESSAGE_SOURCE)
    return direct_message_payload(message)


def table_message_payload(message):
    return {"id": message.id, "sender": player(message.sender), "body": message.body, "created_at": message.created_at}


def _visible_table(user, table_id):
    return get_object_or_404(visible_tables(user), pk=table_id)


def table_chat(user, table_id, after=None):
    table = _visible_table(user, table_id)
    messages = _page(TableMessage.objects.filter(table=table).select_related("sender"), after)
    return {
        "table_id": table.pk,
        "can_post": TableSeat.objects.filter(user=user, table=table).exists(),
        "player_count": table.player_count,
        "messages": [table_message_payload(message) for message in messages],
    }


@transaction.atomic
def send_table_message(user, table_id, body):
    table = _visible_table(user, table_id)
    if not TableSeat.objects.filter(user=user, table=table).exists():
        raise MessagingError("Take a seat at this table to join the chat.", 403)
    now = timezone.now()
    _check_rate(TableMessage.objects.filter(sender=user), now)
    message = TableMessage.objects.create(table=table, sender=user, body=body, created_at=now)
    return table_message_payload(message)
