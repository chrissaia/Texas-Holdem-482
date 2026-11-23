import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

from tables.gameplay import get_game_state
from tables.models import HandParticipant, PokerHand, PokerTable
from tables.seating import join_table


pytestmark = pytest.mark.django_db


def test_best_hand_is_evaluated_for_viewer_without_revealing_opponents():
    User = get_user_model()
    users = [
        User.objects.create_user(
            username=f"private-hand-player-{index}",
            chip_balance=1_000,
            disclaimer_accepted_at=timezone.now(),
        )
        for index in range(2)
    ]
    table = PokerTable.objects.create(
        name="Private hand test",
        host=users[0],
        max_players=2,
        buy_in=100,
        minimum_balance=100,
        small_blind=5,
        big_blind=10,
    )
    for user in users:
        join_table(table.pk, user.pk)

    hand = PokerHand.objects.get(table=table, status=PokerHand.Status.ACTIVE)
    participants = list(hand.participants.order_by("position"))
    HandParticipant.objects.filter(pk=participants[0].pk).update(hole_cards=["As", "Ah"])
    HandParticipant.objects.filter(pk=participants[1].pk).update(hole_cards=["Ks", "Kh"])
    PokerHand.objects.filter(pk=hand.pk).update(board=["2d", "3c", "4h"])

    state = get_game_state(table.pk, users[0].pk)
    players = {player["user_id"]: player for player in state["game"]["players"]}

    assert state["game"]["viewer"]["hand"] == "One Pair - Aces"
    assert players[users[0].pk]["hole_cards"] == ["As", "Ah"]
    assert players[users[1].pk]["hole_cards"] is None
    assert players[users[1].pk]["hand"] is None
