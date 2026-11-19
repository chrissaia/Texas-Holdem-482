from django.apps import AppConfig


class FriendsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "friends"

    def ready(self):
        # Registers the S20 login/logout presence signal receivers.
        from . import presence  # noqa: F401
