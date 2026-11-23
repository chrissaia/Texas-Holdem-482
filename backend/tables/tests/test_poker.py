import pytest

from tables.poker import best_hand, hand_description, new_deck


def test_new_deck_contains_every_card_once():
    deck = new_deck()

    assert len(deck) == 52
    assert len(set(deck)) == 52


@pytest.mark.parametrize(
    ("cards", "category"),
    [
        (["Ts", "Js", "Qs", "Ks", "As"], "Royal Flush"),
        (["As", "2s", "3s", "4s", "5s"], "Straight Flush"),
        (["Ah", "Ad", "Ac", "As", "2h"], "Four of a Kind"),
        (["Kh", "Kd", "Kc", "2s", "2h"], "Full House"),
        (["Ah", "Jh", "8h", "4h", "2h"], "Flush"),
        (["As", "2h", "3d", "4c", "5s"], "Straight"),
        (["Kh", "Kd", "Kc", "2s", "3h"], "Three of a Kind"),
        (["Kh", "Kd", "2c", "2s", "3h"], "Two Pair"),
        (["Kh", "Kd", "2c", "3s", "4h"], "One Pair"),
        (["Kh", "Qd", "8c", "3s", "2h"], "High Card"),
    ],
)
def test_best_hand_recognizes_each_category(cards, category):
    assert best_hand(cards)[1] == category


def test_best_hand_compares_kickers_and_ace_low_straights():
    wheel, _ = best_hand(["As", "2h", "3d", "4c", "5s"])
    six_high, _ = best_hand(["2s", "3h", "4d", "5c", "6s"])
    pair_with_ace_kicker, _ = best_hand(["Kh", "Kd", "Ac", "3s", "4h"])
    pair_with_queen_kicker, _ = best_hand(["Ks", "Kc", "Qh", "3d", "4c"])

    assert six_high > wheel
    assert pair_with_ace_kicker > pair_with_queen_kicker
    assert hand_description(["As", "2h", "3d", "4c", "5s"]) == "Straight - 5s"


@pytest.mark.parametrize(
    "cards",
    [
        ["As", "As", "3d", "4c", "5s"],
        ["As", "2h", "3d", "4c"],
        ["As", "2h", "3d", "4c", "5s", "6h", "7d", "8c"],
        ["1s", "2h", "3d", "4c", "5s"],
        ["As", "2h", "3d", "4c", "5x"],
    ],
)
def test_best_hand_rejects_invalid_cards(cards):
    with pytest.raises(ValueError):
        best_hand(cards)
