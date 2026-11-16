"""Authenticated REST endpoints for a player's private poker-game view and actions."""

from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from .gameplay import GameConflict, advance_game_timeout, apply_game_action, get_game_state
from .permissions import CanHostTable


class GameActionInput(serializers.Serializer):
    """Validate a player action without trusting client identity or chip state."""

    action = serializers.ChoiceField(choices=("fold", "check", "call", "raise", "all_in"))
    raise_to = serializers.IntegerField(
        required=False, min_value=1, max_value=9_007_199_254_740_991
    )

    def validate(self, attrs):
        if attrs["action"] == "raise" and "raise_to" not in attrs:
            raise serializers.ValidationError({"raise_to": ["A raise amount is required."]})
        if attrs["action"] != "raise" and "raise_to" in attrs:
            raise serializers.ValidationError({"raise_to": ["Only a raise accepts an amount."]})
        return attrs


class GameConflictResponse(APIException):
    status_code = 409
    default_code = "game_conflict"


def _validate_exact_fields(data, allowed):
    if not isinstance(data, dict):
        raise ValidationError("Supply a JSON object.")
    unknown = set(data) - allowed
    if unknown:
        raise ValidationError({key: ["Unknown field."] for key in unknown})


@never_cache
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([CanHostTable])
def game_state(request, pk):
    """Return game information safe for this one seated player."""
    state = get_game_state(pk, request.user.pk)
    state["csrf_token"] = get_token(request)
    return Response(state)


@never_cache
@api_view(["POST"])
@permission_classes([CanHostTable])
def game_action(request, pk):
    """Apply one action only when the authenticated player owns the turn."""
    _validate_exact_fields(request.data, {"action", "raise_to"})
    action = GameActionInput(data=request.data)
    action.is_valid(raise_exception=True)
    try:
        state, detail = apply_game_action(
            pk,
            request.user.pk,
            action.validated_data["action"],
            raise_to=action.validated_data.get("raise_to"),
        )
    except GameConflict as error:
        raise GameConflictResponse(str(error)) from error
    state["csrf_token"] = get_token(request)
    if detail:
        return Response({"detail": detail, "game": state}, status=409)
    return Response(state)


@never_cache
@api_view(["POST"])
@permission_classes([CanHostTable])
def game_timeout(request, pk):
    """Ask the server to apply a timeout only if its saved deadline has passed."""
    _validate_exact_fields(request.data, set())
    try:
        state = advance_game_timeout(pk, request.user.pk)
    except GameConflict as error:
        raise GameConflictResponse(str(error)) from error
    state["csrf_token"] = get_token(request)
    return Response(state)
