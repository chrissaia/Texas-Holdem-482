"""Application operations and transactional state changes for friend requests, relationships and player discovery."""

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404

from .models import Friendship

ACCEPTED = Friendship.Status.ACCEPTED
PENDING = Friendship.Status.PENDING


class FriendshipError(Exception):
    """Report a rejected friendship operation without exposing database details."""
    pass


def involving(user):
    """Involving."""
    return Friendship.objects.filter(Q(from_user=user) | Q(to_user=user))


def locked_pair(user, other):
    """Locked pair."""
    return (
        Friendship.objects.select_for_update()
        .filter(Q(from_user=user, to_user=other) | Q(from_user=other, to_user=user))
        .first()
    )


def player(user):
    """Public identity only; email and other account fields stay private."""
    return {"id": user.pk, "username": user.username}


def friends_payload(user):
    """Friends payload."""
    friends, incoming, outgoing = [], [], []
    for row in involving(user).select_related("from_user", "to_user"):
        sent = row.from_user_id == user.pk
        other = row.to_user if sent else row.from_user
        entry = {"id": row.pk, "player": player(other), "created_at": row.created_at}
        if row.status == ACCEPTED:
            friends.append(entry)
        else:
            (outgoing if sent else incoming).append(entry)
    friends.sort(key=lambda entry: entry["player"]["username"].lower())
    return {"friends": friends, "incoming": incoming, "outgoing": outgoing}


@transaction.atomic
def send_request(user, target):
    """Create a pending request, or accept the target's request if they already asked.

    Returns True when a new request was created.
    """
    if target.pk == user.pk:
        raise FriendshipError("You can't add yourself as a friend.")
    existing = locked_pair(user, target)
    if existing is None:
        try:
            with transaction.atomic():
                Friendship.objects.create(from_user=user, to_user=target)
                return True
        except IntegrityError:
            # A request for this pair committed after our check; the database
            # constraint caught it, so continue with the row that won.
            existing = locked_pair(user, target)
    if existing.status == ACCEPTED:
        raise FriendshipError(f"You're already friends with {target.username}.")
    if existing.from_user_id == user.pk:
        raise FriendshipError(f"You already sent {target.username} a friend request.")
    existing.status = ACCEPTED
    existing.save(update_fields=["status"])
    return False


@transaction.atomic
def accept_request(user, pk):
    """Accept request."""
    request = get_object_or_404(
        Friendship.objects.select_for_update(), pk=pk, to_user=user, status=PENDING
    )
    request.status = ACCEPTED
    request.save(update_fields=["status"])


def delete_or_404(queryset):
    """Delete or 404."""
    deleted, _ = queryset.delete()
    if not deleted:
        raise Http404


def decline_request(user, pk):
    """Decline request."""
    delete_or_404(Friendship.objects.filter(pk=pk, to_user=user, status=PENDING))


def cancel_request(user, pk):
    """Cancel request."""
    delete_or_404(Friendship.objects.filter(pk=pk, from_user=user, status=PENDING))


def remove_friend(user, pk):
    # Either player in the friendship may end it.
    """Remove an accepted friendship owned by the current player."""
    delete_or_404(involving(user).filter(pk=pk, status=ACCEPTED))
