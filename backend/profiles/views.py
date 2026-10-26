from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from tables.permissions import CanHostTable
from .avatars import normalize_avatar, replace_avatar
from .rewards import AlreadyClaimed, BalanceLimit, claim_daily_chips, reward_status


class RegisteredAccountPermission(CanHostTable):
    message = "Sign in with a registered account to use avatars and rewards."


def profile_payload(user):
    return {
        "id": user.pk, "username": user.username,
        "avatar_url": user.avatar.url if user.avatar else None,
        "chip_balance": user.chip_balance,
        "starting_chips_granted_at": user.starting_chips_granted_at,
        "daily_reward": reward_status(user),
    }


@never_cache
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([RegisteredAccountPermission])
def profile(request):
    return Response({**profile_payload(request.user), "csrf_token": get_token(request)})


@never_cache
@api_view(["POST"])
@permission_classes([RegisteredAccountPermission])
@parser_classes([MultiPartParser, FormParser])
def avatar(request):
    if set(request.data) != {"avatar"} or len(request.FILES.getlist("avatar")) != 1:
        raise ValidationError({"avatar": ["Supply exactly one avatar image and no other fields."]})
    upload = request.FILES["avatar"]
    user = replace_avatar(request.user.pk, normalize_avatar(upload))
    return Response(profile_payload(user))


@never_cache
@api_view(["POST"])
@permission_classes([RegisteredAccountPermission])
def daily(request):
    if not isinstance(request.data, dict) or request.data:
        raise ValidationError({"non_field_errors": ["This action accepts an empty JSON object only."]})
    try:
        user = claim_daily_chips(request.user.pk)
    except AlreadyClaimed:
        return Response({"detail": "Today's daily chips have already been claimed."}, status=409)
    except BalanceLimit:
        return Response({"detail": "Your balance is at its limit. No chips were changed."}, status=409)
    return Response(profile_payload(user))
