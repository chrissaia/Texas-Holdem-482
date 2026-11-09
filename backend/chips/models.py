"""A durable receipt for each game-result change to an account balance."""
from django.conf import settings
from django.db import models
from django.db.models import Q

from profiles.rewards import MAX_BALANCE


class ChipResult(models.Model):
    """Keep the original result so retries cannot apply the same change twice."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chip_results",
    )
    source = models.CharField(max_length=100)
    delta = models.BigIntegerField()
    balance_after = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        """Enforce receipt identity and supported integer bounds in PostgreSQL."""

        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "source"], name="chips_unique_user_result",
            ),
            models.CheckConstraint(
                condition=Q(delta__gte=-MAX_BALANCE, delta__lte=MAX_BALANCE),
                name="chips_result_delta_bounds",
            ),
            models.CheckConstraint(
                condition=Q(balance_after__lte=MAX_BALANCE),
                name="chips_result_balance_bounds",
            ),
        ]
