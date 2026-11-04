"""Validate and normalize authoritative event facts, never browser submissions."""
CATEGORIES = {"high_card", "pair", "two_pair", "three_of_a_kind", "straight", "flush", "full_house", "four_of_a_kind", "straight_flush", "royal_flush"}


def normalize_facts(kind, facts):
    if kind == "tournament_stage":
        if not isinstance(facts, dict) or set(facts) != {"entrants", "starting_tables", "stage"}:
            raise ValueError("Tournament stage facts require entrants, starting_tables and stage")
        entrants, tables = facts["entrants"], facts["starting_tables"]
        if type(entrants) is not int or type(tables) is not int or not 1 <= tables <= entrants:
            raise ValueError("Tournament counts must be positive whole numbers")
        if facts["stage"] not in ("final_table", "heads_up"):
            raise ValueError("Unknown tournament stage")
        return dict(facts)
    if facts is None:
        return {}
    if not isinstance(facts, dict) or (kind != "hand" and facts):
        raise ValueError("Only hand events accept facts")
    if set(facts) - {"hole_cards", "showdown", "category", "preflop_all_in", "starting_stack", "starting_stacks"}:
        raise ValueError("Unknown hand facts")
    result = dict(facts)
    for key in ("showdown", "preflop_all_in"):
        if key in result and type(result[key]) is not bool:
            raise ValueError("Hand flags must be booleans")
    if "starting_stack" in result or "starting_stacks" in result:
        stack, stacks = result.get("starting_stack"), result.get("starting_stacks")
        if type(stack) is not int or stack <= 0 or not isinstance(stacks, list) or not 2 <= len(stacks) <= 9:
            raise ValueError("Supply a positive player starting stack and 2–9 player stacks")
        if any(type(value) is not int or value <= 0 for value in stacks) or stack not in stacks:
            raise ValueError("Starting stacks must be positive integers and include the player")
        result["starting_stacks"] = sorted(stacks)
    if "hole_cards" in result:
        cards = result["hole_cards"]
        if not isinstance(cards, (list, tuple)) or len(cards) != 2:
            raise ValueError("Supply exactly two hole cards")
        for card in cards:
            if not isinstance(card, str) or len(card) != 2 or card[0] not in "23456789TJQKA" or card[1] not in "shdc":
                raise ValueError("Use card notation such as As or Th")
        if cards[0] == cards[1]:
            raise ValueError("Hole cards must be distinct")
        result["hole_cards"] = sorted(cards)
    if "category" in result:
        if not isinstance(result["category"], str) or result["category"] not in CATEGORIES or result.get("showdown") is not True:
            raise ValueError("A valid showdown category requires showdown=True")
    return result


def hand_achievements(outcome, facts):
    codes = []
    cards = facts.get("hole_cards", [])
    if cards and all(card[0] == "A" for card in cards):
        codes.append("pocket_aces")
    if outcome != "win":
        return codes
    if cards and {card[0] for card in cards} == {"7", "2"} and cards[0][1] != cards[1][1]:
        codes.append("seven_two")
    if facts.get("preflop_all_in"):
        codes.append("preflop_all_in")
    stacks = facts.get("starting_stacks", [])
    if stacks and facts["starting_stack"] == min(stacks) and stacks.count(min(stacks)) == 1:
        codes.append("comeback")
    category = facts.get("category")
    if category in {"straight", "flush", "full_house", "four_of_a_kind", "royal_flush"}:
        codes.append(category)
    return codes
