from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, transaction
from django.db.models import Sum
from rest_framework.test import APIClient

from progression.catalog import ACHIEVEMENTS
from progression.models import Achievement, Event, Progress
from progression.services import record_event

pytestmark = pytest.mark.django_db


def xp(user):
    return Event.objects.filter(user=user).aggregate(value=Sum("xp"))["value"] or 0


def test_catalog_preserves_first_ten():
    assert len(ACHIEVEMENTS) == 20
    assert list(ACHIEVEMENTS)[:10] == ["welcome", "picture", "host", "friend", "message", "hands_10", "hands_100", "hands_1000", "first_win", "streak"]


@pytest.mark.parametrize(("kind", "code"), [("avatar", "picture"), ("game", "host"), ("friend", "friend"), ("message", "message")])
def test_actions_award_once_even_with_new_sources(registered_user, kind, code):
    assert record_event(registered_user.pk, kind, "1") == [code]
    assert record_event(registered_user.pk, kind, "1") == []
    assert record_event(registered_user.pk, kind, "2") == []
    assert xp(registered_user) == 50


def test_wins_stack_but_retries_do_not(registered_user):
    assert record_event(registered_user.pk, "hand", "h1", outcome="win") == ["welcome", "first_win"]
    assert xp(registered_user) == 200
    record_event(registered_user.pk, "hand", "h2", outcome="win")
    assert record_event(registered_user.pk, "hand", "h3", outcome="win") == ["streak"]
    assert xp(registered_user) == 450
    record_event(registered_user.pk, "hand", "h3", outcome="win")
    assert xp(registered_user) == 450
    assert Progress.objects.get(user=registered_user).hands_played == 3


def test_split_counts_participation_only_and_breaks_streak(registered_user):
    for i in range(2):
        record_event(registered_user.pk, "hand", str(i), outcome="win")
    record_event(registered_user.pk, "hand", "split", outcome="split")
    record_event(registered_user.pk, "hand", "after", outcome="win")
    assert Progress.objects.get(user=registered_user).win_streak == 1
    assert not Achievement.objects.filter(user=registered_user, code="streak").exists()
    assert xp(registered_user) == 400


def test_split_is_not_first_win(registered_user):
    assert record_event(registered_user.pk, "hand", "split", outcome="split") == ["welcome"]
    assert xp(registered_user) == 50


@pytest.mark.parametrize(("before", "code"), [(9, "hands_10"), (99, "hands_100"), (999, "hands_1000")])
def test_hand_milestones_include_folded_hands(registered_user, before, code):
    Progress.objects.create(user=registered_user, hands_played=before)
    record_event(registered_user.pk, "hand", "fold", outcome="loss")
    assert Achievement.objects.filter(user=registered_user, code=code).exists()
    assert Progress.objects.get(user=registered_user).hands_played == before + 1
    assert Event.objects.get(user=registered_user).xp == 50 * Achievement.objects.count()


@pytest.mark.parametrize(("kind", "source", "outcome"), [("fake", "1", ""), ("hand", "", "win"), ("hand", "x" * 101, "win"), ("hand", "1", "tie"), ("game", "1", "win"), ("hand", 123, "win")])
def test_invalid_events_do_not_mutate(registered_user, kind, source, outcome):
    with pytest.raises(ValueError):
        record_event(registered_user.pk, kind, source, outcome=outcome)
    assert not Event.objects.exists()
    assert not Achievement.objects.exists()


def test_cannot_rewrite_hand(registered_user):
    record_event(registered_user.pk, "hand", "1", outcome="split")
    with pytest.raises(ValueError):
        record_event(registered_user.pk, "hand", "1", outcome="win")
    assert xp(registered_user) == 50


def test_inactive_denied(registered_user):
    registered_user.is_active = False
    registered_user.save()
    with pytest.raises(ValueError):
        record_event(registered_user.pk, "game", "1")
    assert not Event.objects.exists()


def test_originating_failure_rolls_back_award(registered_user):
    with pytest.raises(RuntimeError), transaction.atomic():
        record_event(registered_user.pk, "game", "1")
        raise RuntimeError("action failed")
    assert not Event.objects.exists()
    assert not Achievement.objects.exists()


def test_collection_hides_locked_details_and_other_users(registered_client, registered_user):
    other = get_user_model().objects.create_user(username="other")
    record_event(other.pk, "game", "1")
    record_event(registered_user.pk, "avatar", "a")
    response = registered_client.get("/api/achievements/")
    assert response.status_code == 200
    assert response.data["total_xp"] == 50
    assert response.data["total_achievements"] == 20
    assert [a["name"] for a in response.data["earned"]] == ["Picture Perfect"]
    assert "House Rules" not in str(response.data)
    assert "Welcome to the Table" not in str(response.data)
    assert "no-store" in response["Cache-Control"]
    assert registered_client.post("/api/achievements/", {"code": "streak", "xp": 500}).status_code in (403, 405)
    assert xp(registered_user) == 50


def test_anonymous_and_guests_cannot_read(guest_client):
    assert APIClient().get("/api/achievements/").status_code == 403
    assert guest_client.get("/api/achievements/").status_code == 403


def test_real_table_creation_hook(registered_client, registered_user):
    data = {"name": "XP table", "max_players": 6, "buy_in": 100, "minimum_balance": 100, "small_blind": 5, "big_blind": 10}
    assert registered_client.post("/api/tables/", data, format="json").status_code == 201
    assert registered_client.post("/api/tables/", data, format="json").status_code == 201
    assert xp(registered_user) == 50
    assert Achievement.objects.get(user=registered_user).code == "host"


def test_invalid_table_does_not_award(registered_client):
    assert registered_client.post("/api/tables/", {}, format="json").status_code == 400
    assert not Achievement.objects.exists()


def test_avatar_hook_and_failure_cleanup(registered_user, tmp_path, settings):
    from django.core.files.base import ContentFile
    from profiles.avatars import replace_avatar
    settings.MEDIA_ROOT = tmp_path
    replace_avatar(registered_user.pk, ContentFile(b"normalized", name="avatar.webp"))
    assert Achievement.objects.get(user=registered_user).code == "picture"
    assert xp(registered_user) == 50
    old = get_user_model().objects.get(pk=registered_user.pk).avatar.name
    with patch("profiles.avatars.record_event", side_effect=RuntimeError("grant failed")), pytest.raises(RuntimeError):
        replace_avatar(registered_user.pk, ContentFile(b"normalized2", name="other.webp"))
    assert get_user_model().objects.get(pk=registered_user.pk).avatar.name == old
    assert len(list(tmp_path.rglob("*.webp"))) == 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_source", [True, False])
def test_concurrent_actions_pay_achievement_once(same_source):
    user = get_user_model().objects.create_user(username="race")
    barrier = Barrier(2)
    def worker(index):
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            return record_event(user.pk, "game", "same" if same_source else str(index))
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(worker, range(2)))
    assert sum(len(r) for r in results) == 1
    assert xp(user) == 50
    assert Achievement.objects.filter(user=user).count() == 1


@pytest.mark.parametrize(("facts", "code"), [
    ({"hole_cards": ["As", "Ah"]}, "pocket_aces"),
    ({"hole_cards": ["7s", "2h"]}, "seven_two"),
    ({"preflop_all_in": True}, "preflop_all_in"),
    *[({"showdown": True, "category": category}, category) for category in ("straight", "flush", "full_house", "four_of_a_kind", "royal_flush")],
])
def test_new_hand_trophies_pay_once_and_stack(registered_user, facts, code):
    awarded = record_event(registered_user.pk, "hand", "new1", outcome="win", facts=facts)
    assert code in awarded
    assert xp(registered_user) == 100 + 50 * len(awarded)
    assert record_event(registered_user.pk, "hand", "new1", outcome="win", facts=facts) == []
    second = record_event(registered_user.pk, "hand", "new2", outcome="win", facts=facts)
    assert code not in second
    assert Achievement.objects.filter(user=registered_user, code=code).count() == 1


@pytest.mark.parametrize("outcome", ["split", "loss"])
def test_non_wins_cannot_earn_win_trophies(registered_user, outcome):
    earned = record_event(registered_user.pk, "hand", "no-win", outcome=outcome,
                          facts={"hole_cards": ["7s", "2h"], "preflop_all_in": True, "showdown": True, "category": "royal_flush"})
    assert earned == ["welcome"]
    assert xp(registered_user) == 50


def test_pocket_aces_requires_only_being_dealt(registered_user):
    earned = record_event(registered_user.pk, "hand", "fold-aces", outcome="loss", facts={"hole_cards": ["Ah", "As"]})
    assert earned == ["welcome", "pocket_aces"]
    assert record_event(registered_user.pk, "hand", "fold-aces", outcome="loss", facts={"hole_cards": ["As", "Ah"]}) == []
    assert xp(registered_user) == 100


def test_seven_two_suited_is_not_offsuit(registered_user):
    assert "seven_two" not in record_event(registered_user.pk, "hand", "suited", outcome="win", facts={"hole_cards": ["7s", "2s"]})


@pytest.mark.parametrize("facts", [
    [], {"amount": 500}, {"hole_cards": ["As"]}, {"hole_cards": ["As", "As"]},
    {"hole_cards": ["Xs", "2h"]}, {"hole_cards": ["10s", "2h"]},
    {"hole_cards": [3, "2h"]}, {"hole_cards": "AsAh"},
    {"preflop_all_in": "true"}, {"showdown": 1}, {"category": "flush"},
    {"showdown": True, "category": "invented"}, {"showdown": True, "category": []},
])
def test_malformed_hand_facts_do_not_award(registered_user, facts):
    with pytest.raises(ValueError):
        record_event(registered_user.pk, "hand", "invalid", outcome="win", facts=facts)
    assert not Event.objects.exists()
    assert not Achievement.objects.exists()


def test_replayed_hand_cannot_change_facts(registered_user):
    record_event(registered_user.pk, "hand", "immutable", outcome="win")
    with pytest.raises(ValueError):
        record_event(registered_user.pk, "hand", "immutable", outcome="win", facts={"hole_cards": ["As", "Ah"]})
    assert xp(registered_user) == 200


def test_tournament_debut_champion_and_retry(registered_user):
    assert record_event(registered_user.pk, "tournament", "t1", outcome="loss") == ["tournament_debut"]
    assert xp(registered_user) == 50
    assert record_event(registered_user.pk, "tournament", "t2", outcome="win") == ["tournament_champion"]
    assert xp(registered_user) == 1100
    assert record_event(registered_user.pk, "tournament", "t2", outcome="win") == []
    assert record_event(registered_user.pk, "tournament", "t3", outcome="win") == []
    assert xp(registered_user) == 2100


@pytest.mark.parametrize(("outcome", "facts"), [("split", None), ("", None), ("win", {"hole_cards": ["As", "Ah"]})])
def test_invalid_tournament_events(registered_user, outcome, facts):
    with pytest.raises(ValueError):
        record_event(registered_user.pk, "tournament", "bad", outcome=outcome, facts=facts)
    assert not Event.objects.exists()


def test_multiple_new_trophies_stack(registered_user):
    codes = record_event(registered_user.pk, "hand", "stack", outcome="win", facts={"hole_cards": ["7s", "2h"], "preflop_all_in": True, "showdown": True, "category": "full_house"})
    assert set(codes) == {"welcome", "first_win", "seven_two", "preflop_all_in", "full_house"}
    assert xp(registered_user) == 350


def test_seven_two_repeat_bonus_stacks_without_duplicate_trophy(registered_user, registered_client):
    facts = {"hole_cards": ["7s", "2h"]}
    record_event(registered_user.pk, "hand", "first72", outcome="win", facts=facts)
    assert xp(registered_user) == 250
    assert record_event(registered_user.pk, "hand", "second72", outcome="win", facts=facts) == []
    assert Event.objects.get(source="second72").xp == 150
    assert xp(registered_user) == 400
    record_event(registered_user.pk, "hand", "second72", outcome="win", facts=facts)
    assert xp(registered_user) == 400
    assert Achievement.objects.filter(user=registered_user, code="seven_two").count() == 1
    payload = registered_client.get("/api/achievements/").data
    assert payload["total_xp"] == 400
    assert next(a for a in payload["earned"] if a["code"] == "seven_two")["repeat_xp"] == 50


@pytest.mark.parametrize("outcome", ["split", "loss"])
def test_repeat_seven_two_requires_an_outright_win(registered_user, outcome):
    facts = {"hole_cards": ["7s", "2h"]}
    record_event(registered_user.pk, "hand", "won72", outcome="win", facts=facts)
    record_event(registered_user.pk, "hand", "notwon72", outcome=outcome, facts=facts)
    assert Event.objects.get(source="notwon72").xp == 0
    assert xp(registered_user) == 250


@pytest.mark.parametrize(("kind", "base_xp"), [("hand", 100), ("tournament", 1000)])
def test_repeated_wins_pay_base_xp_once_per_source(registered_user, kind, base_xp):
    record_event(registered_user.pk, kind, "win1", outcome="win")
    initial = xp(registered_user)
    record_event(registered_user.pk, kind, "win2", outcome="win")
    assert xp(registered_user) == initial + base_xp
    record_event(registered_user.pk, kind, "win2", outcome="win")
    assert xp(registered_user) == initial + base_xp
