from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import RegexValidator
from rest_framework import serializers

USERNAME_RULE = RegexValidator(
    r"^[A-Za-z0-9_.-]+$", "Use only letters, numbers, periods, hyphens, and underscores."
)
GUEST_NAME_RULE = RegexValidator(
    r"^[A-Za-z0-9 _-]+$", "Use only letters, numbers, spaces, hyphens, and underscores."
)


class StrictSerializer(serializers.Serializer):
    """Reject fields the endpoint does not accept, matching the tables API."""

    def validate(self, attrs):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {field: ["This field is not allowed."] for field in sorted(unknown)}
            )
        return attrs


class RegistrationSerializer(StrictSerializer):
    username = serializers.CharField(min_length=3, max_length=30, validators=[USERNAME_RULE])
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        value = value.lower()
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with that email already exists.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # The unsaved user lets Django reject passwords similar to the username/email.
        candidate = get_user_model()(username=attrs["username"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"password": list(error.messages)})
        return attrs


class LoginSerializer(StrictSerializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)


class GuestSerializer(StrictSerializer):
    name = serializers.CharField(min_length=2, max_length=20, validators=[GUEST_NAME_RULE])

    def validate_name(self, value):
        # Guests cannot impersonate a registered player.
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That name belongs to a registered player.")
        return value
