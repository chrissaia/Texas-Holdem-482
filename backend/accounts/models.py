from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Shared user extension point. Finn owns account and session behavior."""
