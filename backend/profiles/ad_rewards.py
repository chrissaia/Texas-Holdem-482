"""First-party rewarded ads. The server owns eligibility, timing and payouts."""
from datetime import timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import transaction
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import AdRewardPolicy, AdView, RewardedAd
from .rewards import MAX_BALANCE, UTC
from .views import RegisteredAccountPermission, profile_payload

DAILY_LIMIT = 3
VIEW_LIFETIME = timedelta(minutes=15)


class AdConflict(APIException):
    status_code = 409


def daily_limit():
    return AdRewardPolicy.objects.values_list("daily_limit", flat=True).first() or DAILY_LIMIT


def completed_today(user, day):
    return AdView.objects.filter(user=user, day=day, completed_at__isnull=False)


def locked_player(request):
    user = get_object_or_404(get_user_model().objects.select_for_update(), pk=request.user.pk)
    if not user.is_active:
        raise PermissionDenied()
    return user


def empty_body(request):
    if not isinstance(request.data, dict) or request.data:
        raise ValidationError("Send an empty JSON object.")


@never_cache
@api_view(["GET"])
@permission_classes([RegisteredAccountPermission])
def ads(request):
    completed = set(completed_today(request.user, timezone.now().astimezone(UTC).date()).values_list("ad_id", flat=True))
    limit = daily_limit()
    return Response({
        "csrf_token": get_token(request),
        "daily_limit": limit,
        "remaining": max(0, limit - len(completed)),
        "ads": [{"id": ad.pk, "title": ad.title, "kind": ad.kind, "media_url": ad.media.url,
                 "reward": ad.reward, "view_seconds": ad.view_seconds, "claimed": ad.pk in completed}
                for ad in RewardedAd.objects.filter(active=True).order_by("pk")],
    })


@never_cache
@api_view(["POST"])
@permission_classes([RegisteredAccountPermission])
@transaction.atomic
def start(request, pk):
    empty_body(request)
    user = locked_player(request)
    ad = get_object_or_404(RewardedAd.objects.select_for_update(), pk=pk, active=True)
    now = timezone.now()
    day = now.astimezone(UTC).date()
    completed = completed_today(user, day)
    if completed.filter(ad=ad).exists() or completed.count() >= daily_limit():
        raise AdConflict("You have reached the reward limit for this ad or today.")
    # Keep one rewardable playback at a time, including across browser tabs.
    AdView.objects.filter(user=user, completed_at__isnull=True).exclude(ad=ad, day=day).delete()
    # Starting a new playback invalidates the old token and restarts the timer.
    view, _ = AdView.objects.update_or_create(user=user, ad=ad, day=day, defaults={
        "token": uuid4(), "started_at": now, "ad_revision": ad.updated_at,
    })
    return Response({"token": view.token, "view_seconds": ad.view_seconds, "kind": ad.kind,
                     "media_url": ad.media.url, "title": ad.title})


@never_cache
@api_view(["POST"])
@permission_classes([RegisteredAccountPermission])
@transaction.atomic
def claim(request, token):
    empty_body(request)
    user = locked_player(request)
    view = get_object_or_404(AdView, token=token, user=user)
    if view.completed_at:
        return Response({"profile": profile_payload(user), "awarded": view.awarded_chips})
    ad = RewardedAd.objects.select_for_update().get(pk=view.ad_id)
    now = timezone.now()
    elapsed = now - view.started_at
    if (not ad.active or ad.updated_at != view.ad_revision or elapsed >= VIEW_LIFETIME
            or view.day != now.astimezone(UTC).date()):
        raise AdConflict("This ad session expired or the ad changed. Refresh and start again.")
    if elapsed < timedelta(seconds=ad.view_seconds):
        raise AdConflict("Keep the ad open until the required viewing time has passed.")
    if completed_today(user, view.day).count() >= daily_limit():
        raise AdConflict("You have reached today's ad reward limit.")
    if user.chip_balance > MAX_BALANCE - ad.reward:
        raise AdConflict("Your balance is at its limit. No chips were changed.")
    user.chip_balance += ad.reward
    user.save(update_fields=["chip_balance"])
    view.completed_at = now
    view.awarded_chips = ad.reward
    view.save(update_fields=["completed_at", "awarded_chips"])
    return Response({"profile": profile_payload(user), "awarded": ad.reward})
