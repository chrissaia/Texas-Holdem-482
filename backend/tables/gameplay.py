"""Authoritative no-limit Texas Hold'em hand and betting operations."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from .access import require_table_access
from .models import HandParticipant, PokerAction, PokerHand, PokerTable, TableSeat
from .poker import CATEGORY_CODES, best_hand, hand_description, new_deck
from .live_updates import queue_game_update

TURN_SECONDS = 30


class GameConflict(Exception):
    """Signal a legal game-state conflict without changing chips or cards."""


def _lock_roster(table):
    user_ids = list(
        TableSeat.objects.filter(table=table).order_by("user_id").values_list("user_id", flat=True)
    )
    locked_users = list(
        get_user_model().objects.select_for_update().filter(pk__in=user_ids).order_by("pk")
    )
    seats = list(
        TableSeat.objects.select_for_update(of=("self",)).filter(table=table).order_by("pk")
    )
    return locked_users, seats


def _lock_table_and_seats(table_id, user_id):
    table = get_object_or_404(PokerTable.objects.select_for_update(), pk=table_id)
    locked_users, locked_seats = _lock_roster(table)
    user = next((candidate for candidate in locked_users if candidate.pk == user_id), None)
    if user is None or not user.is_active or getattr(user, "is_guest", False):
        raise PermissionDenied("Sign in with an active registered account to play.")
    require_table_access(table, user)
    viewer_seat = next((seat for seat in locked_seats if seat.user_id == user_id), None)
    if viewer_seat is None:
        raise PermissionDenied("Join this table before opening the game.")
    return table, user, locked_seats


def _next_hand_number(table):
    latest = PokerHand.objects.filter(table=table).order_by("-hand_number").first()
    return latest.hand_number + 1 if latest else 1


def _next_dealer(seats, previous):
    if not previous:
        return seats[0]
    previous_seat_id = previous.dealer_seat_key
    if previous_seat_id is None:
        previous_seat_id = (
            TableSeat.objects.filter(table=previous.table, user_id=previous.dealer_user_id)
            .values_list("pk", flat=True)
            .first()
        )
    return next((seat for seat in seats if seat.pk > (previous_seat_id or 0)), seats[0])


def _record_action(hand, participant, kind, amount=0):
    return PokerAction.objects.create(
        hand=hand,
        participant=participant,
        street=hand.street,
        kind=kind,
        amount=amount,
    )


def _contribute(hand, participant, amount, kind):
    if amount <= 0 or participant.seat is None or amount > participant.seat.stack:
        raise GameConflict("That chip amount is not available.")
    participant.seat.stack -= amount
    participant.seat.save(update_fields=["stack"])
    participant.round_contribution += amount
    participant.total_contribution += amount
    participant.save(update_fields=["round_contribution", "total_contribution"])
    hand.pot += amount
    hand.save(update_fields=["pot"])
    _record_action(hand, participant, kind, amount)


def start_hand_if_ready(table):
    """Start a hand immediately when a waiting table has two funded seats."""
    if table.status == PokerTable.Status.CLOSED:
        return None
    if PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).exists():
        return None
    eligible = list(
        TableSeat.objects.filter(table=table, stack__gt=0, is_sitting_out=False, user__is_active=True)
        .select_related("user")
        .order_by("pk")
    )
    if len(eligible) < 2:
        table.status = PokerTable.Status.WAITING
        table.save(update_fields=["status"])
        return None

    previous = PokerHand.objects.filter(table=table).order_by("-hand_number").first()
    dealer = _next_dealer(eligible, previous)
    dealer_index = eligible.index(dealer)
    ordered_seats = eligible[dealer_index:] + eligible[:dealer_index]
    deck = new_deck()
    hand = PokerHand.objects.create(
        table=table,
        hand_number=_next_hand_number(table),
        status=PokerHand.Status.ACTIVE,
        street=PokerHand.Street.PREFLOP,
        deck=deck,
        min_raise=table.big_blind,
        dealer_user=dealer.user,
        dealer_seat_key=dealer.pk,
    )
    participants = []
    for position, seat in enumerate(ordered_seats):
        participant = HandParticipant.objects.create(
            hand=hand,
            seat=seat,
            user=seat.user,
            position=position,
            hole_cards=[deck.pop(), deck.pop()],
            starting_stack=seat.stack,
        )
        participants.append(participant)
    hand.deck = deck
    hand.save(update_fields=["deck"])

    count = len(participants)
    small_blind = participants[0] if count == 2 else participants[1]
    big_blind = participants[1] if count == 2 else participants[2]
    _contribute(
        hand, small_blind, min(table.small_blind, small_blind.seat.stack),
        PokerAction.Kind.SMALL_BLIND,
    )
    _contribute(
        hand, big_blind, min(table.big_blind, big_blind.seat.stack),
        PokerAction.Kind.BIG_BLIND,
    )
    for participant in participants:
        if participant.seat.stack == 0:
            participant.all_in = True
            participant.preflop_all_in = True
            participant.save(update_fields=["all_in", "preflop_all_in"])
    hand.current_bet = max(p.round_contribution for p in participants)
    hand.save(update_fields=["current_bet"])
    table.status = PokerTable.Status.PLAYING
    table.last_activity_at = timezone.now()
    table.save(update_fields=["status", "last_activity_at"])
    _progress(hand, table, timezone.now(), after_position=big_blind.position)
    return hand


def _participants(hand, lock=False):
    query = HandParticipant.objects.filter(hand=hand).select_related("seat", "user").order_by("position")
    if lock:
        query = query.select_for_update(of=("self",))
    return list(query)


def _needs_action(player, current_bet):
    return (
        not player.folded
        and not player.all_in
        and player.seat is not None
        and (not player.has_acted or player.round_contribution < current_bet)
    )


def _next_actor(players, current_bet, after_position, street):
    count = len(players)
    if after_position is None:
        start = 0 if count == 2 else 3
    else:
        start = (after_position + 1) % count
    for offset in range(count):
        position = (start + offset) % count
        candidate = players[position]
        if _needs_action(candidate, current_bet):
            return candidate
    return None


def _set_turn(hand, player, now):
    hand.turn_user = player.user if player else None
    hand.turn_started_at = now if player else None
    hand.turn_deadline = None
    if player:
        hand.turn_deadline = now if player.seat.is_sitting_out else now + timedelta(seconds=TURN_SECONDS)
    hand.save(update_fields=["turn_user", "turn_started_at", "turn_deadline"])


def _deal_next_street(hand, players):
    if hand.street == PokerHand.Street.PREFLOP:
        cards_to_deal = 3
        next_street = PokerHand.Street.FLOP
    elif hand.street == PokerHand.Street.FLOP:
        cards_to_deal = 1
        next_street = PokerHand.Street.TURN
    elif hand.street == PokerHand.Street.TURN:
        cards_to_deal = 1
        next_street = PokerHand.Street.RIVER
    else:
        return False
    deck = list(hand.deck)
    hand.burned_cards = [*hand.burned_cards, deck[0]]
    hand.board = [*hand.board, *deck[1:cards_to_deal + 1]]
    hand.deck = deck[cards_to_deal + 1:]
    hand.street = next_street
    hand.current_bet = 0
    hand.min_raise = hand.table.big_blind
    for player in players:
        player.round_contribution = 0
        player.has_acted = False
        player.save(update_fields=["round_contribution", "has_acted"])
    hand.save(update_fields=[
        "board", "deck", "burned_cards", "street", "current_bet", "min_raise",
    ])
    return True


def _clockwise_winners(winners, player_count):
    return sorted(winners, key=lambda player: player.position or player_count)


def _pay_pots(hand, players, ranks):
    levels = sorted({player.total_contribution for player in players if player.total_contribution})
    previous_level = 0
    split_winner_ids = set()
    for level in levels:
        contributors = [player for player in players if player.total_contribution >= level]
        amount = (level - previous_level) * len(contributors)
        eligible = [player for player in contributors if not player.folded]
        if not eligible:
            active = [player for player in players if not player.folded and player.total_contribution < level]
            max_active_contribution = max(player.total_contribution for player in active)
            eligible = [player for player in active if player.total_contribution == max_active_contribution]
        best_rank = max(ranks[player.pk] for player in eligible)
        winners = [player for player in eligible if ranks[player.pk] == best_rank]
        if len(winners) > 1:
            split_winner_ids.update(player.pk for player in winners)
        share, remainder = divmod(amount, len(winners))
        ordered = _clockwise_winners(winners, len(players))
        for index, winner in enumerate(ordered):
            payout = share + (1 if index < remainder else 0)
            winner.won_amount += payout
            winner.is_winner = True
        previous_level = level
    return split_winner_ids


def _finish_hand(hand, table, players, now, showdown):
    from progression.services import record_event

    if showdown:
        ranks = {}
        for player in players:
            if not player.folded:
                ranks[player.pk], name = best_hand([*player.hole_cards, *hand.board])
                player.hand_category = name
        split_winner_ids = _pay_pots(hand, players, ranks)
    else:
        winners = [player for player in players if not player.folded]
        if len(winners) != 1:
            raise GameConflict("The hand cannot be settled without a remaining player.")
        winner = winners[0]
        winner.is_winner = True
        winner.won_amount = hand.pot
        split_winner_ids = set()

    for player in players:
        if player.is_winner:
            player.seat.stack += player.won_amount
            player.seat.save(update_fields=["stack"])
        player.save(update_fields=["is_winner", "won_amount", "hand_category"])

    hand.status = PokerHand.Status.COMPLETE
    hand.street = PokerHand.Street.COMPLETE
    hand.turn_user = None
    hand.turn_started_at = None
    hand.turn_deadline = None
    hand.completed_at = now
    hand.save(update_fields=[
        "status", "street", "turn_user", "turn_started_at", "turn_deadline", "completed_at",
    ])
    table.status = PokerTable.Status.WAITING
    table.last_activity_at = now
    table.save(update_fields=["status", "last_activity_at"])

    starting_stacks = [player.starting_stack for player in players]
    for player in players:
        facts = {
            "hole_cards": player.hole_cards,
            "preflop_all_in": player.preflop_all_in,
            "starting_stack": player.starting_stack,
            "starting_stacks": starting_stacks,
        }
        player_outcome = (
            "split" if player.pk in split_winner_ids
            else "win" if player.is_winner
            else "loss"
        )
        if showdown and not player.folded:
            facts["showdown"] = True
            facts["category"] = CATEGORY_CODES[player.hand_category]
        record_event(player.user_id, "hand", str(hand.pk), outcome=player_outcome, facts=facts)


def _runout_and_showdown(hand, table, players, now):
    while len(hand.board) < 5:
        if not _deal_next_street(hand, players):
            break
    _finish_hand(hand, table, players, now, showdown=True)


def _progress(hand, table, now, after_position=None):
    players = _participants(hand, lock=True)
    remaining = [player for player in players if not player.folded]
    if len(remaining) == 1:
        _finish_hand(hand, table, players, now, showdown=False)
        return
    can_act = [player for player in remaining if not player.all_in]
    if not can_act or (
        len(can_act) == 1 and can_act[0].round_contribution >= hand.current_bet
    ):
        _runout_and_showdown(hand, table, players, now)
        return

    while hand.status == PokerHand.Status.ACTIVE:
        actor = _next_actor(players, hand.current_bet, after_position, hand.street)
        if actor is not None:
            _set_turn(hand, actor, now)
            return
        if hand.street == PokerHand.Street.RIVER:
            _finish_hand(hand, table, players, now, showdown=True)
            return
        if not _deal_next_street(hand, players):
            raise GameConflict("The betting round could not advance.")
        if not any(not player.folded and not player.all_in for player in players):
            _runout_and_showdown(hand, table, players, now)
            return
        after_position = 0


def _apply_action(hand, table, actor, kind, now, raise_to=None, timed_out=False):
    to_call = max(0, hand.current_bet - actor.round_contribution)
    if kind == "fold":
        actor.folded = True
        actor.has_acted = True
        actor.save(update_fields=["folded", "has_acted"])
        _record_action(hand, actor, PokerAction.Kind.TIMEOUT_FOLD if timed_out else PokerAction.Kind.FOLD)
    elif kind == "check":
        if to_call:
            raise GameConflict("You cannot check while facing a bet.")
        actor.has_acted = True
        actor.save(update_fields=["has_acted"])
        _record_action(hand, actor, PokerAction.Kind.TIMEOUT_CHECK if timed_out else PokerAction.Kind.CHECK)
    elif kind == "call":
        if not to_call:
            raise GameConflict("There is no bet to call.")
        paid = min(to_call, actor.seat.stack)
        _contribute(hand, actor, paid, PokerAction.Kind.CALL)
        actor.refresh_from_db()
        actor.has_acted = True
        actor.all_in = actor.seat.stack == 0
        if actor.all_in and hand.street == PokerHand.Street.PREFLOP:
            actor.preflop_all_in = True
        actor.save(update_fields=["has_acted", "all_in", "preflop_all_in"])
    elif kind == "raise":
        if type(raise_to) is not int:
            raise GameConflict("Choose a whole-chip raise amount.")
        if actor.has_acted:
            raise GameConflict("Betting was not reopened for you; call or fold.")
        max_raise_to = actor.round_contribution + actor.seat.stack
        min_raise_to = hand.current_bet + hand.min_raise
        if raise_to <= hand.current_bet or raise_to > max_raise_to:
            raise GameConflict("The raise must be above the current bet and within your stack.")
        if raise_to < min_raise_to:
            raise GameConflict("A raise must meet the minimum raise or use All In.")
        increment = raise_to - hand.current_bet
        paid = raise_to - actor.round_contribution
        _contribute(
            hand,
            actor,
            paid,
            PokerAction.Kind.BET if hand.current_bet == 0 else PokerAction.Kind.RAISE,
        )
        for player in _participants(hand, lock=True):
            if not player.folded and not player.all_in:
                player.has_acted = False
                player.save(update_fields=["has_acted"])
        actor.refresh_from_db()
        actor.has_acted = True
        actor.all_in = actor.seat.stack == 0
        if actor.all_in and hand.street == PokerHand.Street.PREFLOP:
            actor.preflop_all_in = True
        actor.save(update_fields=["has_acted", "all_in", "preflop_all_in"])
        hand.current_bet = raise_to
        hand.min_raise = increment
        hand.save(update_fields=["current_bet", "min_raise"])
    elif kind == "all_in":
        amount = actor.seat.stack
        if amount <= 0:
            raise GameConflict("You have no chips left to bet.")
        target = actor.round_contribution + amount
        raises = target > hand.current_bet
        if raises and actor.has_acted:
            raise GameConflict("Betting was not reopened for you; call or fold.")
        full_raise = raises and target - hand.current_bet >= hand.min_raise
        _contribute(hand, actor, amount, PokerAction.Kind.ALL_IN)
        actor.refresh_from_db()
        actor.all_in = True
        actor.has_acted = True
        actor.preflop_all_in = actor.preflop_all_in or hand.street == PokerHand.Street.PREFLOP
        actor.save(update_fields=["all_in", "has_acted", "preflop_all_in"])
        if full_raise:
            hand.min_raise = target - hand.current_bet
            for player in _participants(hand, lock=True):
                if not player.folded and not player.all_in and player.pk != actor.pk:
                    player.has_acted = False
                    player.save(update_fields=["has_acted"])
        hand.current_bet = max(hand.current_bet, target)
        hand.save(update_fields=["current_bet", "min_raise"])
    else:
        raise GameConflict("Choose fold, check, call, raise, or all-in.")

    _progress(hand, table, now, after_position=actor.position)
    if hand.status == PokerHand.Status.COMPLETE:
        start_hand_if_ready(table)


def _latest_completed(table, exclude=None):
    query = PokerHand.objects.filter(table=table, status=PokerHand.Status.COMPLETE)
    if exclude is not None:
        query = query.exclude(pk=exclude.pk)
    return query.order_by("-hand_number").first()


def _summary(hand):
    if hand is None:
        return None
    winners = list(hand.participants.filter(is_winner=True).select_related("user").order_by("position"))
    return {
        "number": hand.hand_number,
        "pot": hand.pot,
        "winners": [
            {
                "user_id": player.user_id,
                "username": player.user.username,
                "amount": player.won_amount,
                "hand": player.hand_category or None,
            }
            for player in winners
        ],
        "board": hand.board,
    }


def _game_payload(table, viewer_id):
    current = PokerHand.objects.filter(table=table, status=PokerHand.Status.ACTIVE).first()
    last = _latest_completed(table, exclude=current)
    seats = list(TableSeat.objects.filter(table=table).select_related("user").order_by("pk"))
    seated_by_id = {seat.pk: seat for seat in seats}
    viewer = next((seat for seat in seats if seat.user_id == viewer_id), None)
    if viewer is None:
        raise PermissionDenied("Join this table before opening the game.")

    game = None
    if current:
        participants = list(current.participants.select_related("user", "seat").order_by("position"))
        me = next((player for player in participants if player.user_id == viewer_id), None)
        amount_to_call = max(0, current.current_bet - me.round_contribution) if me else 0
        can_act = (
            me is not None
            and current.turn_user_id == viewer_id
            and not me.folded
            and not me.all_in
            and not viewer.is_sitting_out
        )
        max_raise_to = me.round_contribution + viewer.stack if me else 0
        min_raise_to = current.current_bet + current.min_raise
        legal = {
            "fold": can_act,
            "check": can_act and amount_to_call == 0,
            "call": can_act and amount_to_call > 0,
            "raise": can_act and not me.has_acted and max_raise_to >= min_raise_to,
            "all_in": can_act and viewer.stack > 0 and (
                max_raise_to <= current.current_bet or not me.has_acted
            ),
            "amount_to_call": amount_to_call,
            "min_raise_to": min_raise_to,
            "max_raise_to": max_raise_to,
        }
        players = []
        for player in participants:
            seat = seated_by_id.get(player.seat_id)
            reveal = current.status == PokerHand.Status.COMPLETE and not player.folded
            cards = player.hole_cards if player.user_id == viewer_id or reveal else None
            players.append({
                "user_id": player.user_id,
                "username": player.user.username,
                "stack": seat.stack if seat else 0,
                "round_bet": player.round_contribution,
                "folded": player.folded,
                "all_in": player.all_in,
                "is_dealer": player.position == 0,
                "is_turn": current.turn_user_id == player.user_id,
                "hole_cards": cards,
                "hand": player.hand_category or None if reveal else None,
                "waiting": False,
            })
        participating_seats = {player.seat_id for player in participants if player.seat_id}
        waiting_players = [
            {
                "user_id": seat.user_id,
                "username": seat.user.username,
                "stack": seat.stack,
                "waiting": True,
            }
            for seat in seats
            if seat.pk not in participating_seats
        ]
        game = {
            "id": current.pk,
            "number": current.hand_number,
            "street": current.street,
            "board": current.board,
            "pot": current.pot,
            "current_bet": current.current_bet,
            "min_raise": current.min_raise,
            "dealer_user_id": current.dealer_user_id,
            "turn_user_id": current.turn_user_id,
            "turn_started_at": current.turn_started_at,
            "turn_deadline": current.turn_deadline,
            "players": players,
            "waiting_players": waiting_players,
            "viewer": {
                "user_id": viewer_id,
                "hole_cards": me.hole_cards if me else None,
                "hand": hand_description([*me.hole_cards, *current.board]) if me and len(current.board) >= 3 else None,
                "legal_actions": legal,
            },
            "actions": [
                {
                    "username": action.participant.user.username,
                    "kind": action.get_kind_display(),
                    "amount": action.amount,
                    "street": action.street,
                }
                for action in current.actions.select_related("participant__user").order_by("pk")
            ],
        }
    return {
        "viewer_id": viewer_id,
        "table": {
            "id": table.pk,
            "name": table.name,
            "is_public": table.is_public,
            "status": table.status,
            "max_players": table.max_players,
            "player_count": table.player_count,
            "small_blind": table.small_blind,
            "big_blind": table.big_blind,
        },
        "game": game,
        "last_hand": _summary(last),
        "seated_players": [
            {"user_id": seat.user_id, "username": seat.user.username, "stack": seat.stack,
             "is_sitting_out": seat.is_sitting_out}
            for seat in seats
        ],
        "csrf_token": "",
    }


def get_game_state(table_id, viewer_id):
    """Return only the requesting seated player's private game view."""
    table = get_object_or_404(PokerTable.objects.select_related("host"), pk=table_id)
    user = get_user_model().objects.filter(pk=viewer_id, is_active=True).first()
    if user is None or getattr(user, "is_guest", False):
        raise PermissionDenied("Sign in with an active registered account to play.")
    require_table_access(table, user)
    return _game_payload(table, viewer_id)


@transaction.atomic
def apply_game_action(table_id, user_id, action, raise_to=None, expected_turn=None):
    """Validate and apply one action for the server-designated player."""
    table, user, _ = _lock_table_and_seats(table_id, user_id)
    hand = PokerHand.objects.select_for_update().filter(
        table=table, status=PokerHand.Status.ACTIVE
    ).first()
    if hand is None:
        raise GameConflict("There is no active hand. Wait for another player to join.")
    if expected_turn is not None and (hand.pk, hand.turn_started_at) != expected_turn:
        raise GameConflict("That turn has changed. Refresh the table before acting.")
    players = _participants(hand, lock=True)
    actor = next((player for player in players if player.user_id == user_id), None)
    if actor is None or hand.turn_user_id != user_id:
        raise GameConflict("It is not your turn. Refresh the table to see the latest game state.")
    now = timezone.now()
    if hand.turn_deadline and now >= hand.turn_deadline:
        _apply_expired_turn(hand, table, actor, now)
        return _game_payload(table, user_id), "Your turn expired; the automatic action was applied."
    if actor.seat.is_sitting_out:
        raise GameConflict("Resume play before taking an action.")
    _apply_action(hand, table, actor, action, now, raise_to=raise_to)
    queue_game_update(table.pk)
    return _game_payload(table, user_id), None


@transaction.atomic
def advance_game_timeout(table_id, user_id):
    """Apply the server-selected check-or-fold after the turn deadline."""
    table, user, _ = _lock_table_and_seats(table_id, user_id)
    _advance_expired_turn(table)
    return _game_payload(table, user.pk)


def _apply_expired_turn(hand, table, actor, now):
    actor.seat.is_sitting_out = True
    actor.seat.save(update_fields=["is_sitting_out"])
    kind = "check" if actor.round_contribution == hand.current_bet else "fold"
    _apply_action(hand, table, actor, kind, now, timed_out=True)
    queue_game_update(table.pk)


def _advance_expired_turn(table, user_id=None):
    now = timezone.now()
    hand = PokerHand.objects.select_for_update().filter(
        table=table, status=PokerHand.Status.ACTIVE, turn_deadline__lte=now,
        turn_user__isnull=False,
    ).first()
    if not hand or (user_id is not None and hand.turn_user_id != user_id):
        return False
    actor = next(
        (player for player in _participants(hand, lock=True) if player.user_id == hand.turn_user_id),
        None,
    )
    if actor is None or actor.seat_id is None:
        raise GameConflict("The current turn has no funded seat.")
    _apply_expired_turn(hand, table, actor, now)
    return True


@transaction.atomic
def process_expired_table(table_id):
    """Process one due turn under the same table lock as player actions."""
    table = PokerTable.objects.select_for_update(skip_locked=True).filter(pk=table_id).first()
    if table is None:
        return False
    _lock_roster(table)
    return _advance_expired_turn(table)


@transaction.atomic
def resume_game_play(table_id, user_id):
    """Clear only the viewer's sit-out flag and start a hand if eligible."""
    table, user, seats = _lock_table_and_seats(table_id, user_id)
    seat = next(seat for seat in seats if seat.user_id == user.pk)
    if seat.is_sitting_out:
        # Resolve an already-expired turn before restoring the seat.
        _advance_expired_turn(table, user_id=user.pk)
        seat.is_sitting_out = False
        seat.save(update_fields=["is_sitting_out"])
        start_hand_if_ready(table)
        queue_game_update(table.pk)
    return _game_payload(table, user.pk)
