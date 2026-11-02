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
        return f"{self.from_user} -> {self.to_user} ({self.status})"
