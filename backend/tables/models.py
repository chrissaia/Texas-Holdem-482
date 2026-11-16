"""Persisted records and database constraints for public poker-table configuration and browsing."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Cast
from django.utils import timezone

SEAT_OPTIONS = (2, 4, 6, 8, 9)
MAX_CHIPS = 2_147_483_647


def chip_field():
    """Construct a positive whole-chip model field with the shared storage limits."""
    return models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(MAX_CHIPS)]
    )


class PokerTable(models.Model):
    """Store host-owned table settings and server-controlled occupancy and activity."""
    class Status(models.TextChoices):
        """Enumerate the persisted lifecycle states accepted by a table."""
        WAITING = "waiting", "Waiting"
        PLAYING = "playing", "Playing"
        CLOSED = "closed", "Closed"

    name = models.CharField(max_length=80)
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="hosted_tables"
    )
    is_public = models.BooleanField(default=True)
    max_players = models.PositiveSmallIntegerField(choices=[(n, n) for n in SEAT_OPTIONS])
    buy_in = chip_field()
    minimum_balance = chip_field()
    small_blind = chip_field()
    big_blind = chip_field()
    player_count = models.PositiveSmallIntegerField(default=0, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    last_activity_at = models.DateTimeField(default=timezone.now, db_index=True, editable=False)

    class Meta:
        """Declare Django model or serializer metadata for the enclosing class."""
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=~Q(name__regex=r"^\s*$"), name="table_name_not_blank"),
            models.CheckConstraint(condition=Q(max_players__in=SEAT_OPTIONS), name="table_valid_capacity"),
            models.CheckConstraint(condition=Q(buy_in__gte=1), name="table_positive_buy_in"),
            models.CheckConstraint(condition=Q(minimum_balance__gte=1), name="table_positive_min_balance"),
            models.CheckConstraint(condition=Q(small_blind__gte=1), name="table_positive_small_blind"),
            models.CheckConstraint(condition=Q(big_blind__gte=1), name="table_positive_big_blind"),
            models.CheckConstraint(
                condition=Q(big_blind=Cast(F("small_blind"), models.BigIntegerField()) * 2),
                name="table_double_big_blind",
            ),
            models.CheckConstraint(condition=Q(buy_in__gte=F("big_blind")), name="table_buy_in_covers_blind"),
            models.CheckConstraint(condition=Q(minimum_balance__gte=F("buy_in")), name="table_balance_covers_buy_in"),
            models.CheckConstraint(condition=Q(player_count__lte=F("max_players")), name="table_occupancy_within_capacity"),
            models.CheckConstraint(condition=Q(status__in=("waiting", "playing", "closed")), name="table_valid_status"),
        ]

    def clean(self):
        """Clean."""
        super().clean()
        self.name = self.name.strip()
        errors = {}
        if not self.name:
            errors["name"] = "Enter a table name."
        # Field validation runs separately; do not compare absent/invalid values.
        if all(isinstance(v, int) for v in (self.small_blind, self.big_blind, self.buy_in, self.minimum_balance)):
            if self.big_blind != self.small_blind * 2:
                errors["big_blind"] = "Big blind must be twice the small blind."
            if self.buy_in < self.big_blind:
                errors["buy_in"] = "Buy-in must be at least the big blind."
            if self.minimum_balance < self.buy_in:
                errors["minimum_balance"] = "Minimum balance must be at least the buy-in."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        """Return the human-readable label used by Django administration and diagnostics."""
        return self.name


class TableSeat(models.Model):
    """One funded seat per registered player; held chips are separate from the wallet."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                               related_name="table_seat")
    table = models.ForeignKey(PokerTable, on_delete=models.PROTECT, related_name="seats")
    buy_in = models.PositiveIntegerField()
    stack = models.PositiveBigIntegerField()
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(buy_in__gte=1), name="seat_positive_buy_in"),
            models.CheckConstraint(condition=Q(stack__lte=9_007_199_254_740_991),
                                   name="seat_stack_safe_integer"),
        ]


class TableInvitation(models.Model):
    """Grant one active account access to a host's private table."""

    table = models.ForeignKey(PokerTable, on_delete=models.CASCADE, related_name="invitations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="table_invitations")
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        """Keep each private-table invitation unique."""
        constraints = [models.UniqueConstraint(fields=["table", "user"], name="unique_table_invitation")]


class PokerHand(models.Model):
    """Persist one server-dealt hand and its authoritative betting state."""

    class Street(models.TextChoices):
        PREFLOP = "preflop", "Pre-flop"
        FLOP = "flop", "Flop"
        TURN = "turn", "Turn"
        RIVER = "river", "River"
        COMPLETE = "complete", "Complete"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETE = "complete", "Complete"

    table = models.ForeignKey(PokerTable, on_delete=models.PROTECT, related_name="hands")
    hand_number = models.PositiveIntegerField()
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.ACTIVE)
    street = models.CharField(max_length=8, choices=Street.choices, default=Street.PREFLOP)
    board = models.JSONField(default=list)
    deck = models.JSONField(default=list)
    burned_cards = models.JSONField(default=list)
    pot = models.PositiveBigIntegerField(default=0)
    current_bet = models.PositiveBigIntegerField(default=0)
    min_raise = models.PositiveBigIntegerField()
    dealer_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="dealer_hands"
    )
    dealer_seat_key = models.PositiveBigIntegerField(null=True, blank=True)
    turn_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.PROTECT, related_name="turn_hands",
    )
    turn_started_at = models.DateTimeField(null=True, blank=True)
    turn_deadline = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(default=timezone.now, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-hand_number"]
        constraints = [
            models.UniqueConstraint(fields=["table", "hand_number"], name="unique_table_hand_number"),
            models.UniqueConstraint(
                fields=["table"], condition=Q(status="active"), name="one_active_hand_per_table"
            ),
        ]


class HandParticipant(models.Model):
    """Store private cards and chip contributions for one player in a hand."""

    hand = models.ForeignKey(PokerHand, on_delete=models.PROTECT, related_name="participants")
    seat = models.ForeignKey(
        TableSeat, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="hand_participations",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="poker_hand_participations"
    )
    position = models.PositiveSmallIntegerField()
    hole_cards = models.JSONField()
    starting_stack = models.PositiveBigIntegerField()
    round_contribution = models.PositiveBigIntegerField(default=0)
    total_contribution = models.PositiveBigIntegerField(default=0)
    has_acted = models.BooleanField(default=False)
    folded = models.BooleanField(default=False)
    all_in = models.BooleanField(default=False)
    preflop_all_in = models.BooleanField(default=False)
    is_winner = models.BooleanField(default=False)
    won_amount = models.PositiveBigIntegerField(default=0)
    hand_category = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["hand", "seat"], name="unique_hand_seat"),
            models.UniqueConstraint(fields=["hand", "user"], name="unique_hand_user"),
        ]


class PokerAction(models.Model):
    """Keep an immutable, ordered record of forced bets and player actions."""

    class Kind(models.TextChoices):
        SMALL_BLIND = "small_blind", "Small blind"
        BIG_BLIND = "big_blind", "Big blind"
        FOLD = "fold", "Fold"
        CHECK = "check", "Check"
        CALL = "call", "Call"
        BET = "bet", "Bet"
        RAISE = "raise", "Raise"
        ALL_IN = "all_in", "All-in"
        TIMEOUT_CHECK = "timeout_check", "Timed out: check"
        TIMEOUT_FOLD = "timeout_fold", "Timed out: fold"

    hand = models.ForeignKey(PokerHand, on_delete=models.PROTECT, related_name="actions")
    participant = models.ForeignKey(HandParticipant, on_delete=models.PROTECT, related_name="actions")
    street = models.CharField(max_length=8, choices=PokerHand.Street.choices)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["created_at", "pk"]
