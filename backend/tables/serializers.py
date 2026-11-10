"""Input validation and public response fields for public poker-table configuration and browsing."""

from collections.abc import Mapping

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import MAX_CHIPS, PokerTable


class WholeNumberField(serializers.IntegerField):
    """Reject booleans, fractions and malformed values before integer validation."""
    def to_internal_value(self, data):
        """Validate and normalize external input before it reaches application services."""
        if isinstance(data, bool):
            self.fail("invalid")
        return super().to_internal_value(data)


class TableSerializer(serializers.ModelSerializer):
    """Validate table settings and serialize the safe public table representation."""
    host = serializers.SerializerMethodField()
    max_players = WholeNumberField(min_value=2, max_value=9)
    buy_in = WholeNumberField(min_value=1, max_value=MAX_CHIPS)
    minimum_balance = WholeNumberField(min_value=1, max_value=MAX_CHIPS)
    small_blind = WholeNumberField(min_value=1, max_value=MAX_CHIPS // 2)
    big_blind = WholeNumberField(min_value=1, max_value=MAX_CHIPS)

    class Meta:
        """Declare Django model or serializer metadata for the enclosing class."""
        model = PokerTable
        fields = (
            "id", "name", "host", "is_public", "max_players", "buy_in",
            "minimum_balance", "small_blind", "big_blind", "player_count",
            "status", "created_at", "last_activity_at",
        )
        read_only_fields = (
            "id", "host", "is_public", "player_count", "status", "created_at", "last_activity_at",
        )

    def get_host(self, obj):
        """Return host for the caller."""
        return {"id": obj.host_id, "username": obj.host.username}

    def to_internal_value(self, data):
        """Validate and normalize external input before it reaches application services."""
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"non_field_errors": ["Expected a JSON object."]})
        allowed = {"name", "max_players", "buy_in", "minimum_balance", "small_blind", "big_blind"}
        errors = {key: ["This field cannot be supplied."] for key in data if key not in allowed}
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def validate(self, attrs):
        """Check cross-field rules and return validated attributes or field errors."""
        table = PokerTable(**attrs)
        try:
            table.full_clean(exclude=["host"], validate_constraints=False)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        attrs["name"] = table.name
        return attrs


class TableListQuerySerializer(serializers.Serializer):
    """Validate supported lobby filters, sort choices and paging inputs."""
    search = serializers.CharField(required=False, allow_blank=True, max_length=150)
    min_buy_in = WholeNumberField(required=False, min_value=1, max_value=MAX_CHIPS)
    max_buy_in = WholeNumberField(required=False, min_value=1, max_value=MAX_CHIPS)
    big_blind = WholeNumberField(required=False, min_value=1, max_value=MAX_CHIPS)
    max_players = serializers.ChoiceField(required=False, choices=(2, 4, 6, 8, 9))
    available_seats = serializers.ChoiceField(required=False, choices=("true", "false"))
    status = serializers.ChoiceField(required=False, choices=("waiting", "playing"))
    ordering = serializers.ChoiceField(
        required=False, default="newest",
        choices=("newest", "name", "buy_in", "-buy_in", "blinds", "players"),
    )
    page = WholeNumberField(required=False, min_value=1, max_value=2_147_483_647)
    page_size = WholeNumberField(required=False, min_value=1, max_value=50)

    def validate(self, attrs):
        """Reject inverted buy-in ranges instead of silently returning no tables."""
        if attrs.get("min_buy_in", 0) > attrs.get("max_buy_in", MAX_CHIPS):
            raise serializers.ValidationError({"min_buy_in": ["Minimum buy-in must not exceed maximum buy-in."]})
        return attrs

    def to_internal_value(self, data):
        """Validate and normalize external input before it reaches application services."""
        errors = {}
        for key in data:
            if key not in self.fields:
                errors[key] = ["Unknown filter."]
            elif len(data.getlist(key)) > 1:
                errors[key] = ["Supply each filter only once."]
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)
