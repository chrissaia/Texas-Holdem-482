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
    return models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(MAX_CHIPS)]
    )


class PokerTable(models.Model):
    class Status(models.TextChoices):
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
        return self.name
