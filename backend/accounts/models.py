from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class User(AbstractUser):
    """Shared user extension point. Finn owns account and session behavior."""

    avatar = models.ImageField(upload_to="avatars/", blank=True, max_length=200)
    chip_balance = models.PositiveBigIntegerField(default=0, editable=False)
    starting_chips_granted_at = models.DateTimeField(null=True, blank=True, editable=False)
    daily_chips_claimed_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta(AbstractUser.Meta):
        constraints = [
            models.CheckConstraint(
                condition=Q(chip_balance__lte=9_007_199_254_740_991),
                name="accounts_balance_js_safe",
            ),
            
            models.UniqueConstraint(
                Lower("username"),
                name="accounts_user_username_ci_unique",
                violation_error_message="A user with that username already exists.",
            ),
            # Blank emails remain allowed for admin-created and fixture accounts.
            models.UniqueConstraint(
                Lower("email"),
                condition=~Q(email=""),
                name="accounts_user_email_ci_unique",
                violation_error_message="An account with that email already exists.",
            ),
        ]
