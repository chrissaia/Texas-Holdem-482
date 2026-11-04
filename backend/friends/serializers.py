from django.contrib.auth import get_user_model
from rest_framework import serializers

from accounts.serializers import StrictSerializer


class FriendRequestSerializer(StrictSerializer):
    username = serializers.CharField(max_length=150)

    def validate_username(self, value):
        # Case-insensitive like login; inactive accounts cannot be found.
        target = get_user_model().objects.filter(username__iexact=value, is_active=True).first()
        if target is None:
            raise serializers.ValidationError("No registered player has that username.")
        return target
