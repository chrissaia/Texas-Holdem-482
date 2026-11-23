from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from progression.models import Event
from tables.gameplay import GameConflict, _next_dealer, _pay_pots, _progress, apply_game_action, get_game_state, process_expired_table
from tables.models import HandParticipant, PokerAction, PokerHand, PokerTable, TableSeat
from tables.seating import join_table

pytestmark = pytest.mark.django_db


def start_heads_up(buy_in=100, max_players=2):
    User = get_user_model()
    users = [
        User.objects.create_user(
            username=f"game-player-{i}", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
        )
        for i in range(2)
    ]
    table = PokerTable.objects.create(
        name="Game test",
        host=users[0],
        max_players=max_players,
        buy_in=buy_in,
        minimum_balance=buy_in,
        small_blind=max(1, buy_in // 20),
        big_blind=max(2, buy_in // 10),
    )
    for user in users:
        join_table(table.pk, user.pk)
    hand = PokerHand.objects.get(table=table, status=PokerHand.Status.ACTIVE)
    return table, users, hand


def test_game_state_shows_only_viewers_private_cards():
    table, users, hand = start_heads_up()
    state = get_game_state(table.pk, users[0].pk)
    players = {player["user_id"]: player for player in state["game"]["players"]}

    assert state["game"]["viewer"]["hole_cards"]
    assert players[users[0].pk]["hole_cards"] == state["game"]["viewer"]["hole_cards"]
    assert players[users[1].pk]["hole_cards"] is None
    assert len(hand.deck) == 48


def test_api_keeps_opponent_cards_private():
    table, users, _ = start_heads_up()
    client = APIClient()
    client.force_login(users[0])

    response = client.get(reverse("tables:game", args=[table.pk]))

    assert response.status_code == 200
    opponent = next(player for player in response.data["game"]["players"] if player["user_id"] == users[1].pk)
    assert opponent["hole_cards"] is None
    assert response["Cache-Control"].find("no-store") >= 0


def test_game_action_requires_csrf_and_rejects_client_controlled_fields():
    table, users, _ = start_heads_up()
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(users[0])
    state_response = client.get(reverse("tables:game", args=[table.pk]))
    action_url = reverse("tables:game-action", args=[table.pk])

    assert state_response.status_code == 200
    assert client.post(action_url, {"action": "fold"}, format="json").status_code == 403
    client.credentials(HTTP_X_CSRFTOKEN=state_response.data["csrf_token"])
    assert client.post(
        action_url,
        {"action": "fold", "user_id": users[1].pk},
        format="json",
    ).status_code == 400
    assert client.post(action_url, {"action": "raise"}, format="json").status_code == 400


def test_fold_settles_hand_records_progression_and_starts_next_hand():
    table, users, hand = start_heads_up()
    actor_id = hand.turn_user_id
    apply_game_action(table.pk, actor_id, "fold")

    completed = PokerHand.objects.get(pk=hand.pk)
    participants = list(completed.participants.order_by("position"))
    winner = next(player for player in participants if player.user_id != actor_id)

    assert completed.status == PokerHand.Status.COMPLETE
    assert winner.is_winner
    assert winner.won_amount == completed.pot
    assert Event.objects.filter(kind="hand", source=str(completed.pk)).count() == 2
    assert PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).count() == 1
    wallet_total = get_user_model().objects.filter(
        pk__in=[user.pk for user in users]
    ).aggregate(total=Sum("chip_balance"))["total"]
    assert wallet_total + sum(
        TableSeat.objects.values_list("stack", flat=True)
    ) + sum(PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).values_list("pot", flat=True)) == 2_000


def test_expired_turn_uses_server_selected_fold():
    table, users, hand = start_heads_up()
    actor_id = hand.turn_user_id
    PokerHand.objects.filter(pk=hand.pk).update(turn_deadline=timezone.now() - timedelta(seconds=1))

    apply_game_action(table.pk, actor_id, "check")

    assert PokerAction.objects.filter(
        hand=hand, participant__user_id=actor_id, kind=PokerAction.Kind.TIMEOUT_FOLD
    ).exists()
    assert PokerHand.objects.get(pk=hand.pk).status == PokerHand.Status.COMPLETE


def test_expired_turn_checks_when_no_bet_is_due():
    table, users, hand = start_heads_up()
    apply_game_action(table.pk, hand.turn_user_id, "call")
    hand.refresh_from_db()
    actor_id = hand.turn_user_id
    PokerHand.objects.filter(pk=hand.pk).update(turn_deadline=timezone.now() - timedelta(seconds=1))

    apply_game_action(table.pk, actor_id, "fold")

    assert PokerAction.objects.filter(
        hand=hand, participant__user_id=actor_id, kind=PokerAction.Kind.TIMEOUT_CHECK
    ).exists()
    assert PokerHand.objects.get(pk=hand.pk).street == PokerHand.Street.FLOP


def test_preflop_all_in_records_verified_fact_for_winners():
    table, users, hand = start_heads_up(buy_in=10)
    actor_id = hand.turn_user_id
    apply_game_action(table.pk, actor_id, "all_in")
    hand.refresh_from_db()
    caller_id = hand.turn_user_id
    apply_game_action(table.pk, caller_id, "call")

    completed = PokerHand.objects.get(pk=hand.pk)
    events = Event.objects.filter(kind="hand", source=str(completed.pk))

    assert completed.status == PokerHand.Status.COMPLETE
    assert events.count() == 2
    assert all(event.facts["preflop_all_in"] for event in events)


def test_inactive_seated_user_cannot_submit_an_action():
    table, users, hand = start_heads_up()
    actor_id = hand.turn_user_id
    get_user_model().objects.filter(pk=actor_id).update(is_active=False)

    with pytest.raises(PermissionDenied):
        apply_game_action(table.pk, actor_id, "fold")


def test_player_who_already_acted_cannot_raise_again_without_reopened_betting():
    table, users, hand = start_heads_up()
    actor_id = hand.turn_user_id
    participant = HandParticipant.objects.get(hand=hand, user_id=actor_id)
    HandParticipant.objects.filter(pk=participant.pk).update(has_acted=True)

    state = get_game_state(table.pk, actor_id)
    assert state["game"]["viewer"]["legal_actions"]["raise"] is False
    with pytest.raises(GameConflict, match="Betting was not reopened"):
        apply_game_action(table.pk, actor_id, "raise", raise_to=hand.current_bet + hand.min_raise)


def test_late_joiner_waits_until_the_next_hand():
    table, users, hand = start_heads_up(max_players=4)
    late_user = get_user_model().objects.create_user(
        username="late-game-player", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
    )
    join_table(table.pk, late_user.pk)

    active = PokerHand.objects.get(pk=hand.pk)
    state = get_game_state(table.pk, users[0].pk)
    assert active.participants.count() == 2
    assert [player["user_id"] for player in state["game"]["waiting_players"]] == [late_user.pk]

    apply_game_action(table.pk, hand.turn_user_id, "fold")
    next_hand = PokerHand.objects.get(table=table, status=PokerHand.Status.ACTIVE)
    assert next_hand.participants.count() == 3
    assert next_hand.participants.filter(user=late_user).exists()


def test_seat_status_allows_waiting_and_folded_players_to_cash_out():
    table, users, hand = start_heads_up(max_players=4)
    late_user = get_user_model().objects.create_user(
        username="waiting-game-player", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
    )
    join_table(table.pk, late_user.pk)
    apply_game_action(table.pk, hand.turn_user_id, "fold")
    next_hand = PokerHand.objects.get(table=table, status=PokerHand.Status.ACTIVE)
    waiting_user = get_user_model().objects.create_user(
        username="next-game-player", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
    )
    join_table(table.pk, waiting_user.pk)
    folded_actor_id = next_hand.turn_user_id
    apply_game_action(table.pk, folded_actor_id, "fold")

    client = APIClient()
    client.force_login(get_user_model().objects.get(pk=folded_actor_id))
    folded_status = client.get(reverse("tables:seat", args=[table.pk]))
    client.force_login(waiting_user)
    waiting_status = client.get(reverse("tables:seat", args=[table.pk]))

    assert folded_status.data["can_leave"] is True
    assert waiting_status.data["can_leave"] is True


def test_dealer_button_advances_after_previous_dealer_leaves():
    table, users, hand = start_heads_up(max_players=4)
    third_user = get_user_model().objects.create_user(username="third-game-player", chip_balance=1_000)
    fourth_user = get_user_model().objects.create_user(username="fourth-game-player", chip_balance=1_000)
    third_seat = TableSeat.objects.create(user=third_user, table=table, buy_in=100, stack=100)
    fourth_seat = TableSeat.objects.create(user=fourth_user, table=table, buy_in=100, stack=100)
    previous = PokerHand.objects.get(pk=hand.pk)
    previous.dealer_seat_key = third_seat.pk
    third_seat.delete()
    eligible = list(TableSeat.objects.filter(table=table).order_by("pk"))

    assert _next_dealer(eligible, previous).pk == fourth_seat.pk


def test_side_pots_are_paid_to_the_best_hand_eligible_for_each_level():
    players = [
        SimpleNamespace(pk=1, total_contribution=50, folded=False, position=0, won_amount=0, is_winner=False),
        SimpleNamespace(pk=2, total_contribution=100, folded=False, position=1, won_amount=0, is_winner=False),
        SimpleNamespace(pk=3, total_contribution=100, folded=False, position=2, won_amount=0, is_winner=False),
    ]

    split_winners = _pay_pots(
        None,
        players,
        {1: (9, 14), 2: (8, 13), 3: (7, 12)},
    )

    assert split_winners == set()
    assert [(player.pk, player.is_winner, player.won_amount) for player in players] == [
        (1, True, 150),
        (2, True, 100),
        (3, False, 0),
    ]


def test_tied_pot_marks_only_the_players_who_shared_it_as_split():
    players = [
        SimpleNamespace(pk=1, total_contribution=50, folded=False, position=0, won_amount=0, is_winner=False),
        SimpleNamespace(pk=2, total_contribution=50, folded=False, position=1, won_amount=0, is_winner=False),
        SimpleNamespace(pk=3, total_contribution=100, folded=False, position=2, won_amount=0, is_winner=False),
    ]

    split_winners = _pay_pots(
        None,
        players,
        {1: (8, 13), 2: (8, 13), 3: (7, 12)},
    )

    assert split_winners == {1, 2}
    assert [(player.pk, player.is_winner, player.won_amount) for player in players] == [
        (1, True, 75),
        (2, True, 75),
        (3, True, 50),
    ]


def test_round_runs_out_when_only_one_player_can_act():
    table, users, hand = start_heads_up()
    participants = list(HandParticipant.objects.filter(hand=hand).order_by("position"))
    HandParticipant.objects.filter(pk=participants[1].pk).update(
        all_in=True,
        total_contribution=10,
        round_contribution=10,
    )
    HandParticipant.objects.filter(pk=participants[0].pk).update(
        total_contribution=10,
        round_contribution=10,
    )
    PokerHand.objects.filter(pk=hand.pk).update(pot=20, current_bet=10)
    hand.refresh_from_db()

    _progress(hand, table, timezone.now(), after_position=participants[1].position)

    hand.refresh_from_db()
    assert hand.status == PokerHand.Status.COMPLETE
    assert len(hand.board) == 5

def expire_turn(hand):
    PokerHand.objects.filter(pk=hand.pk).update(turn_deadline=timezone.now() - timedelta(seconds=1))


def test_worker_sits_out_disconnected_player_and_resume_restarts_play():
    from io import StringIO

    from django.core.management import call_command

    table, users, hand = start_heads_up()
    actor = next(user for user in users if user.pk == hand.turn_user_id)
    output = StringIO()
    call_command("watch_poker_turns", once=True, stdout=output)
    assert "Processed 0" in output.getvalue()
    expire_turn(hand)
    with patch("tables.gameplay.queue_game_update") as notify:
        call_command("watch_poker_turns", once=True, stdout=output)
        notify.assert_called_once_with(table.pk)
    assert "Processed 1" in output.getvalue()
    hand.refresh_from_db()
    assert hand.status == PokerHand.Status.COMPLETE
    assert hand.actions.filter(kind=PokerAction.Kind.TIMEOUT_FOLD).count() == 1
    assert TableSeat.objects.get(user=actor).is_sitting_out
    assert not PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).exists()
    assert sum(TableSeat.objects.filter(table=table).values_list("stack", flat=True)) == 200
    table.refresh_from_db()
    assert table.status == PokerTable.Status.WAITING
    call_command("watch_poker_turns", once=True, stdout=output)
    assert hand.actions.filter(kind=PokerAction.Kind.TIMEOUT_FOLD).count() == 1

    client = APIClient(enforce_csrf_checks=True)
    client.force_login(actor)
    state = client.get(reverse("tables:game", args=[table.pk])).data
    assert next(seat for seat in state["seated_players"] if seat["user_id"] == actor.pk)["is_sitting_out"]
    url = reverse("tables:game-resume", args=[table.pk])
    assert client.post(url, {}, format="json").status_code == 403
    client.credentials(HTTP_X_CSRFTOKEN=state["csrf_token"])
    assert client.post(url, {"user_id": users[1].pk}, format="json").status_code == 400
    resumed = client.post(url, {}, format="json")
    assert resumed.status_code == 200, resumed.data
    assert resumed.data["game"]["number"] == 2
    assert not TableSeat.objects.get(user=actor).is_sitting_out
    assert client.post(url, {}, format="json").data["game"]["number"] == 2


def test_resume_only_changes_the_requesting_seat():
    table, users, hand = start_heads_up()
    expire_turn(hand)
    process_expired_table(table.pk)
    actor = next(user for user in users if user.pk == hand.turn_user_id)
    other = next(user for user in users if user.pk != hand.turn_user_id)
    client = APIClient()
    client.force_login(other)
    url = reverse("tables:game-resume", args=[table.pk])
    assert client.post(url, {}, format="json").status_code == 200
    assert TableSeat.objects.get(user=actor).is_sitting_out
    outsider = get_user_model().objects.create_user(username="not-seated")
    client.force_login(outsider)
    assert client.post(url, {}, format="json").status_code == 403


def test_worker_checks_for_free_and_excludes_afk_seat_from_next_hand():
    table, users, hand = start_heads_up(max_players=4)
    third = get_user_model().objects.create_user(
        username="ready-third", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
    )
    join_table(table.pk, third.pk)
    apply_game_action(table.pk, hand.turn_user_id, "call")
    hand.refresh_from_db()
    missed = hand.turn_user_id
    expire_turn(hand)
    assert process_expired_table(table.pk)
    assert hand.actions.filter(participant__user_id=missed, kind=PokerAction.Kind.TIMEOUT_CHECK).exists()
    hand.refresh_from_db()
    if hand.turn_user_id == missed:
        assert hand.turn_deadline <= timezone.now()
    # End this hand with one valid fold. A sitting-out player still in the
    # current hand is allowed to receive any pot they legitimately win.
    if hand.turn_user_id == missed:
        assert process_expired_table(table.pk)
        hand.refresh_from_db()
    apply_game_action(table.pk, hand.turn_user_id, "fold")
    next_hand = PokerHand.objects.get(table=table, status=PokerHand.Status.ACTIVE)
    assert next_hand.hand_number == 2
    assert set(next_hand.participants.values_list("user_id", flat=True)) == {
        user.pk for user in [*users, third] if user.pk != missed
    }


@pytest.mark.django_db(transaction=True)
def test_worker_and_late_player_action_process_deadline_once():
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from django.db import close_old_connections

    table, _, hand = start_heads_up()
    expire_turn(hand)
    barrier = Barrier(2)

    def attempt(worker):
        close_old_connections()
        try:
            barrier.wait(timeout=5)
            if worker:
                process_expired_table(table.pk)
            else:
                try:
                    apply_game_action(table.pk, hand.turn_user_id, "call")
                except GameConflict:
                    pass  # The worker already finished the hand.
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(attempt, True)
        second = pool.submit(attempt, False)
        first.result(timeout=15)
        second.result(timeout=15)
    assert hand.actions.filter(kind=PokerAction.Kind.TIMEOUT_FOLD).count() == 1
    assert not hand.actions.filter(kind=PokerAction.Kind.CALL).exists()
    assert sum(TableSeat.objects.filter(table=table).values_list("stack", flat=True)) == 200

def test_betting_action_rejects_stale_turn_before_changing_chips():
    table, users, hand = start_heads_up()
    client = APIClient()
    client.force_login(next(user for user in users if user.pk == hand.turn_user_id))
    url = reverse("tables:game-action", args=[table.pk])
    stale = (hand.turn_started_at - timedelta(seconds=30)).isoformat()
    assert client.post(url, {"action": "call", "hand_id": hand.pk}, format="json").status_code == 400
    assert client.post(url, {"action": "call", "hand_id": hand.pk, "turn_started_at": stale},
                       format="json").status_code == 409
    assert not hand.actions.filter(kind=PokerAction.Kind.CALL).exists()
    current = {"action": "call", "hand_id": hand.pk, "turn_started_at": hand.turn_started_at.isoformat()}
    assert client.post(url, current, format="json").status_code == 200
    assert hand.actions.filter(kind=PokerAction.Kind.CALL).count() == 1
