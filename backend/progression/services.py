"""Trusted backend hooks only: call within the originating action's transaction.

Hand hooks require a completed, dealt hand from the authoritative game service,
in completion order per user. A split (including any shared pot) is not a win.
There is deliberately no HTTP endpoint for submitting events or claiming XP.
"""
from django.contrib.auth import get_user_model
from django.db import transaction

from .catalog import ACHIEVEMENT_XP, REPEATABLE_XP
from .facts import normalize_facts, hand_achievements
from .models import Achievement, Event, Progress


@transaction.atomic
def record_event(user_id, kind, source, *, outcome="", facts=None):
    if kind not in {"hand", "avatar", "game", "friend", "message", "tournament", "tournament_stage", "theme"}:
        raise ValueError("Unknown event kind")
    if not isinstance(source, str) or not source.strip() or len(source) > 100:
        raise ValueError("A stable source ID of 1–100 characters is required")
    allowed = {"win", "loss", "split"} if kind == "hand" else {"win", "loss"} if kind == "tournament" else {""}
    if outcome not in allowed:
        raise ValueError("Invalid event outcome")
    facts = normalize_facts(kind, facts)
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.is_active:
        raise ValueError("Progression requires an active registered account")
    previous = Event.objects.filter(user=user, kind=kind, source=source).first()
    if previous:
        if previous.outcome != outcome or previous.facts != facts:
            raise ValueError("An event cannot be rewritten")
        return []
    event = Event.objects.create(user=user, kind=kind, source=source, outcome=outcome, facts=facts)
    candidates = []
    if kind == "hand":
        progress, _ = Progress.objects.get_or_create(user=user)
        progress.hands_played += 1
        progress.win_streak = progress.win_streak + 1 if outcome == "win" else 0
        progress.save(update_fields=["hands_played", "win_streak"])
        candidates.append("welcome")
        candidates.extend(hand_achievements(outcome, facts))
        for count in (10, 100, 1000):
            if progress.hands_played >= count:
                candidates.append(f"hands_{count}")
        if outcome == "win":
            event.xp = 100
            candidates.append("first_win")
        if progress.win_streak >= 3:
            candidates.append("streak")
    elif kind == "tournament_stage":
        if facts["stage"] == "final_table" and facts["starting_tables"] > 1:
            candidates.append("final_table")
        if facts["stage"] == "heads_up" and facts["entrants"] >= 3:
            candidates.append("heads_up")
    elif kind == "tournament":
        candidates.append("tournament_debut")
        if outcome == "win":
            candidates.append("tournament_champion")
            event.xp = 1000
    else:
        candidates.append({"avatar": "picture", "game": "host", "friend": "friend", "message": "message", "theme": "theme"}[kind])
    earned = []
    for code in candidates:
        _, created = Achievement.objects.get_or_create(user=user, code=code)
        if created:
            earned.append(code)
        else:
            event.xp += REPEATABLE_XP.get(code, 0)
    event.xp += ACHIEVEMENT_XP * len(earned)
    event.save(update_fields=["xp"])
    return earned


@transaction.atomic
def save_theme_choice(user_id, theme):
    """Persist an explicit choice and award only on a change from the stored choice."""
    if theme not in ("dark", "light"):
        raise ValueError("Choose dark or light")
    user = get_user_model().objects.select_for_update().get(pk=user_id)
    if not user.is_active:
        raise ValueError("Theme rewards require an active account")
    progress, _ = Progress.objects.get_or_create(user=user)
    if progress.theme != theme:
        progress.theme = theme
        progress.save(update_fields=["theme"])
        record_event(user_id, "theme", "first-change")
    return theme
