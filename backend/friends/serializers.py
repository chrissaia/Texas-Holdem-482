"""Input validation and public response fields for friend requests, relationships and player discovery."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import StrictSerializer


class FriendRequestSerializer(StrictSerializer):
    """Resolve a requested username to an active account and reject unknown fields."""
    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        # Case-insensitive like login; inactive accounts cannot be found.
        """Validate username before accepting the request."""
        target = get_user_model().objects.filter(username__iexact=value, is_active=True).first()
        if target is None:
            raise serializers.ValidationError("No registered player has that username.")
        return target
