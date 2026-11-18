"""Persisted records and database constraints for friend requests, relationships and player discovery."""

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Greatest, Least
from django.utils import timezone


class Friendship(models.Model):
    """One row per pair of players: a pending request or an accepted friendship.

    Declining, cancelling, and removing delete the row, so a player may ask again later.
    """

    class Status(models.TextChoices):
        """Enumerate the persisted friendship states accepted by the model."""
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_sent"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="friend_requests_received"
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        """Declare Django model or serializer metadata for the enclosing class."""
        ordering = ["-created_at", "-id"]
        constraints = [
            models.CheckConstraint(condition=~Q(from_user=F("to_user")), name="friendship_not_self"),
            models.CheckConstraint(
                condition=Q(status__in=("pending", "accepted")), name="friendship_valid_status"
            ),
            # Ordering the pair makes A->B and B->A the same key, so two players share one row.
            models.UniqueConstraint(
                Least("from_user", "to_user"),
                Greatest("from_user", "to_user"),
                name="friendship_unique_pair",
                violation_error_message="These players already have a friendship or request.",
            ),
        ]

    def __str__(self):
        """Return the human-readable label used by Django administration and diagnostics."""
        return f"{self.from_user} -> {self.to_user} ({self.status})"


class Presence(models.Model):
    """S20: when a registered player was last active. Kept off the user row so frequent
    activity writes never wait on the account row locks used for chip balances."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, primary_key=True, related_name="presence"
    )
    last_seen_at = models.DateTimeField(default=timezone.now, db_index=True)

    def __str__(self):
        return f"{self.user} seen {self.last_seen_at:%Y-%m-%d %H:%M}"
