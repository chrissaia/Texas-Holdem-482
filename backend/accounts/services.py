from django.contrib.auth import get_user_model
from django.db import transaction

GUEST_SESSION_KEYS = ("is_guest", "guest_name")
# Guests are session-only; their name lasts one day or until they log out.
GUEST_SESSION_SECONDS = 60 * 60 * 24


@transaction.atomic
def register_user(*, username, email, password):
    """Create a registered account; everything here commits or rolls back together."""
    user = get_user_model().objects.create_user(
        username=username, email=email, password=password
    )
    # Integration point: Royal's starting-chip grant runs here, inside this
    # transaction, so a failed grant also rolls back the new account.
    return user


def clear_guest(session):
    for key in GUEST_SESSION_KEYS:
        session.pop(key, None)


def start_guest(session, name):
    # A new key prevents a pre-planted session ID from being reused (fixation).
    session.cycle_key()
    session["is_guest"] = True
    session["guest_name"] = name
    session.set_expiry(GUEST_SESSION_SECONDS)


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
        }
    if request.session.get("is_guest"):
        return {"state": "guest", "user": None, "guest": {"name": request.session["guest_name"]}}
    return {"state": "anonymous", "user": None, "guest": None}
