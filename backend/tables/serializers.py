from collections.abc import Mapping

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import MAX_CHIPS, PokerTable


class WholeNumberField(serializers.IntegerField):
    def to_internal_value(self, data):
        if isinstance(data, bool):
            self.fail("invalid")
        return super().to_internal_value(data)


class TableSerializer(serializers.ModelSerializer):
    host = serializers.SerializerMethodField()
    max_players = WholeNumberField(min_value=2, max_value=9)
    buy_in = WholeNumberField(min_value=1, max_value=MAX_CHIPS)
    minimum_balance = WholeNumberField(min_value=1, max_value=MAX_CHIPS)
    small_blind = WholeNumberField(min_value=1, max_value=MAX_CHIPS // 2)
    big_blind = WholeNumberField(min_value=1, max_value=MAX_CHIPS)

    class Meta:
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
        return {"id": obj.host_id, "username": obj.host.username}

    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            raise serializers.ValidationError({"non_field_errors": ["Expected a JSON object."]})
        allowed = {"name", "max_players", "buy_in", "minimum_balance", "small_blind", "big_blind"}
        errors = {key: ["This field cannot be supplied."] for key in data if key not in allowed}
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)

    def validate(self, attrs):
        table = PokerTable(**attrs)
        try:
            table.full_clean(exclude=["host"], validate_constraints=False)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        attrs["name"] = table.name
        return attrs


class TableListQuerySerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True, max_length=150)
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

    def to_internal_value(self, data):
        errors = {}
        for key in data:
            if key not in self.fields:
                errors[key] = ["Unknown filter."]
            elif len(data.getlist(key)) > 1:
                errors[key] = ["Supply each filter only once."]
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)
