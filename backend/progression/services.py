"""Trusted backend hooks only: call within the originating action's transaction.

Hand hooks require a completed, dealt hand from the authoritative game service,
in completion order per user. A split (including any shared pot) is not a win.
There is deliberately no HTTP endpoint for submitting events or claiming XP.
"""
from django.contrib.auth import get_user_model
from django.db import transaction

from .catalog import ACHIEVEMENT_XP
from .models import Achievement, Event, Progress


@transaction.atomic
def record_event(user_id, kind, source, *, outcome=""):
    if kind not in {"hand", "avatar", "game", "friend", "message"}:
        raise ValueError("Unknown event kind")
    if not isinstance(source, str) or not source.strip() or len(source) > 100:
        raise ValueError("A stable source ID of 1–100 characters is required")
    if (kind == "hand" and outcome not in {"win", "loss", "split"}) or (kind != "hand" and outcome):
        raise ValueError("Invalid event outcome")
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.is_active:
        raise ValueError("Progression requires an active registered account")
    previous = Event.objects.filter(user=user, kind=kind, source=source).first()
    if previous:
        if previous.outcome != outcome:
            raise ValueError("An event cannot be rewritten")
        return []
    event = Event.objects.create(user=user, kind=kind, source=source, outcome=outcome)
    candidates = []
    if kind == "hand":
        progress, _ = Progress.objects.get_or_create(user=user)
        progress.hands_played += 1
        progress.win_streak = progress.win_streak + 1 if outcome == "win" else 0
        progress.save(update_fields=["hands_played", "win_streak"])
        candidates.append("welcome")
        for count in (10, 100, 1000):
            if progress.hands_played >= count:
                candidates.append(f"hands_{count}")
        if outcome == "win":
            event.xp = 100
            candidates.append("first_win")
        if progress.win_streak >= 3:
            candidates.append("streak")
    else:
        candidates.append({"avatar": "picture", "game": "host", "friend": "friend", "message": "message"}[kind])
    earned = []
    for code in candidates:
        _, created = Achievement.objects.get_or_create(user=user, code=code)
        if created:
            earned.append(code)
    event.xp += ACHIEVEMENT_XP * len(earned)
    event.save(update_fields=["xp"])
    return earned
