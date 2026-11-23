"""Pure card and hand-ranking rules for Texas Hold'em."""

from itertools import combinations
from secrets import SystemRandom

RANKS = "23456789TJQKA"
SUITS = "shdc"
RANK_VALUES = {rank: value for value, rank in enumerate(RANKS, start=2)}
CATEGORY_NAMES = {
    0: "High Card",
    1: "One Pair",
    2: "Two Pair",
    3: "Three of a Kind",
    4: "Straight",
    5: "Flush",
    6: "Full House",
    7: "Four of a Kind",
    8: "Straight Flush",
    9: "Royal Flush",
}
CATEGORY_CODES = {
    "High Card": "high_card",
    "One Pair": "pair",
    "Two Pair": "two_pair",
    "Three of a Kind": "three_of_a_kind",
    "Straight": "straight",
    "Flush": "flush",
    "Full House": "full_house",
    "Four of a Kind": "four_of_a_kind",
    "Straight Flush": "straight_flush",
    "Royal Flush": "royal_flush",
}


def new_deck():
    """Return a securely shuffled standard 52-card deck."""
    deck = [rank + suit for rank in RANKS for suit in SUITS]
    SystemRandom().shuffle(deck)
    return deck


def _straight_high(values):
    unique = set(values)
    if 14 in unique:
        unique.add(1)
    ordered = sorted(unique, reverse=True)
    for index in range(len(ordered) - 4):
        run = ordered[index:index + 5]
        if run[0] - run[4] == 4:
            return run[0]
    return 0


def _rank_five(cards):
    values = sorted((RANK_VALUES[card[0]] for card in cards), reverse=True)
    suits = [card[1] for card in cards]
    counts = {}
    for value in values:
        counts[value] = counts.get(value, 0) + 1
    groups = sorted(((count, value) for value, count in counts.items()), reverse=True)
    flush = len(set(suits)) == 1
    straight = _straight_high(values)

    if flush and straight:
        category = 9 if straight == 14 else 8
        return (category, straight)
    if groups[0][0] == 4:
        four = groups[0][1]
        kicker = max(value for value in values if value != four)
        return (7, four, kicker)
    if groups[0][0] == 3 and groups[1][0] == 2:
        return (6, groups[0][1], groups[1][1])
    if flush:
        return (5, *values)
    if straight:
        return (4, straight)
    if groups[0][0] == 3:
        trips = groups[0][1]
        kickers = sorted((value for value in values if value != trips), reverse=True)
        return (3, trips, *kickers)
    pairs = sorted((value for value, count in counts.items() if count == 2), reverse=True)
    if len(pairs) == 2:
        kicker = max(value for value in values if value not in pairs)
        return (2, *pairs, kicker)
    if len(pairs) == 1:
        pair = pairs[0]
        kickers = sorted((value for value in values if value != pair), reverse=True)
        return (1, pair, *kickers)
    return (0, *values)


def best_hand(cards):
    """Return the comparable rank tuple and category for a five-to-seven-card hand."""
    if len(cards) not in (5, 6, 7) or len(set(cards)) != len(cards):
        raise ValueError("A hand must contain five to seven distinct cards")
    if any(len(card) != 2 or card[0] not in RANK_VALUES or card[1] not in SUITS for card in cards):
        raise ValueError("Cards must use rank/suit notation such as As or Th")
    rank = max(_rank_five(combo) for combo in combinations(cards, 5))
    return rank, CATEGORY_NAMES[rank[0]]


def hand_description(cards):
    """Return a concise human-readable hand category and its decisive ranks."""
    rank, category = best_hand(cards)
    if rank[0] == 2:
        values = (rank[1], rank[2])
    elif rank[0] in (1, 3, 6, 7):
        values = (rank[1],)
    elif rank[0] in (4, 8, 9):
        values = (rank[1],)
    else:
        values = (rank[1],)
    names = {14: "Aces", 13: "Kings", 12: "Queens", 11: "Jacks", 10: "Tens"}
    labels = [names.get(value, str(value) + "s") for value in values]
    return f"{category} - {' and '.join(labels)}"
