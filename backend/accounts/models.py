from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower


class User(AbstractUser):
    """Shared user extension point. Finn owns account and session behavior."""

    class Meta(AbstractUser.Meta):
        constraints = [
            
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
