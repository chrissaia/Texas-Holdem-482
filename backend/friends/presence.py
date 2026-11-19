"""S20: online status for friends.

Every API request from an active registered player refreshes their presence (at most
once a minute). Players count as online while they have been seen within ONLINE_WINDOW,
which the frontend keeps alive by polling. Logging out marks a player offline at once.
"""

from datetime import timedelta

from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver
from django.utils import timezone

from tables.access import visible_tables
from tables.models import TableSeat

from .models import Presence

ONLINE_WINDOW = timedelta(minutes=3)
TOUCH_INTERVAL = timedelta(minutes=1)

OFFLINE, ONLINE, AT_TABLE = "offline", "online", "at_table"


def touch(user, now=None):
    """Record activity, writing at most once per TOUCH_INTERVAL."""
    now = now or timezone.now()
    updated = Presence.objects.filter(user=user, last_seen_at__lt=now - TOUCH_INTERVAL).update(last_seen_at=now)
    if not updated:
        # Either already fresh (nothing to do) or the player has no row yet.
        Presence.objects.bulk_create([Presence(user=user, last_seen_at=now)], ignore_conflicts=True)


def go_offline(user):
    Presence.objects.filter(user=user).delete()


class PresenceMiddleware:
    """Refresh presence for API requests made by active registered players."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if request.path.startswith("/api/") and user is not None and user.is_authenticated and user.is_active:
            touch(user)
        return self.get_response(request)


@receiver(user_logged_in)
def _online_on_login(sender, user, **kwargs):
    touch(user)


@receiver(user_logged_out)
def _offline_on_logout(sender, user, **kwargs):
    if user is not None:
        go_offline(user)


def presence_for(viewer, users, now=None):
    """Map each user ID to {status, table}. Tables are only shown when the viewer may see them,
    so a seat at someone else's private table appears as plain "online"."""
    now = now or timezone.now()
    ids = [user.pk for user in users]
    online = set(
        Presence.objects.filter(user_id__in=ids, last_seen_at__gte=now - ONLINE_WINDOW).values_list("user_id", flat=True)
    )
    seats = {
        seat.user_id: seat.table
        for seat in TableSeat.objects.filter(user_id__in=online, table__in=visible_tables(viewer).values("pk"))
        .select_related("table")
    }
    result = {}
    for user_id in ids:
        table = seats.get(user_id)
        if table is not None:
            result[user_id] = {
                "status": AT_TABLE,
                "table": {
                    "id": table.pk, "name": table.name, "player_count": table.player_count,
                    "max_players": table.max_players, "status": table.status,
                },
            }
        else:
            result[user_id] = {"status": ONLINE if user_id in online else OFFLINE, "table": None}
    return result
