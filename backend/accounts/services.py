"""Application operations and transactional state changes for account identity, authentication and guest sessions."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from profiles.rewards import grant_starting_chips

# Guest disclaimer acceptance is cleared with the guest; an account must accept for itself.
GUEST_SESSION_KEYS = ("is_guest", "guest_name", "guest_disclaimer_accepted")
# Guests are session-only; their name lasts one day or until they log out.
GUEST_SESSION_SECONDS = 60 * 60 * 24


@transaction.atomic
def register_user(*, username, email, password):
    """Create a registered account; everything here commits or rolls back together."""
    user = get_user_model().objects.create_user(
        username=username, email=email, password=password
    )
    return grant_starting_chips(user.pk)


def clear_guest(session):
    """Clear guest."""
    for key in GUEST_SESSION_KEYS:
        session.pop(key, None)


def start_guest(session, name):
    # A new key prevents a pre-planted session ID from being reused (fixation).
    """Start guest."""
    session.cycle_key()
    session["is_guest"] = True
    session["guest_name"] = name
    session.set_expiry(GUEST_SESSION_SECONDS)


def accept_disclaimer(request):
    """Record S3 acceptance for the signed-in account or the current guest session.

    The first acceptance time is kept; repeating the request changes nothing.
    """
    user = request.user
    if user.is_authenticated:
        get_user_model().objects.filter(
            pk=user.pk, disclaimer_accepted_at__isnull=True
        ).update(disclaimer_accepted_at=timezone.now())
        user.refresh_from_db(fields=["disclaimer_accepted_at"])
    else:
        request.session["guest_disclaimer_accepted"] = True


def disclaimer_accepted(request):
    """Whether this account or guest session has accepted the play-money disclaimer."""
    if request.user.is_authenticated:
        return request.user.disclaimer_accepted_at is not None
    return bool(request.session.get("is_guest") and request.session.get("guest_disclaimer_accepted"))


def session_payload(request):
    """Shared session contract consumed by the frontend and other owners."""
    user = request.user
    if user.is_authenticated:
        return {
            "state": "registered",
            "user": {
                "id": user.pk,
                "username": user.username,
                "email": user.email,
                "is_admin": user.is_staff,
            },
            "guest": None,
            "disclaimer_accepted": disclaimer_accepted(request),
        }
    if request.session.get("is_guest"):
        return {
            "state": "guest",
            "user": None,
            "guest": {"name": request.session["guest_name"]},
            "disclaimer_accepted": disclaimer_accepted(request),
        }
    return {"state": "anonymous", "user": None, "guest": None, "disclaimer_accepted": False}
