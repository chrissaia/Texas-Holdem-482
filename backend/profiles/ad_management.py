"""In-app ad administration backed by the same upload form as Django admin."""
from django.db import transaction
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from .ad_forms import RewardedAdForm
from .ad_permissions import CanManageAds
from .ad_rewards import AdConflict, daily_limit
from .models import AdRewardPolicy, RewardedAd


def ad_data(ad):
    return {"id": ad.pk, "title": ad.title, "kind": ad.kind, "active": ad.active,
            "reward": ad.reward, "view_seconds": ad.view_seconds, "media_url": ad.media.url,
            "revision": ad.updated_at.isoformat()}


def save_ad(request, instance=None):
    fields = {"title", "kind", "active", "reward", "view_seconds", "media"}
    if instance:
        fields.add("revision")
    data = request.data
    if set(data) - fields or any(len(data.getlist(key)) != 1 for key in data):
        raise ValidationError("Unexpected or repeated ad fields.")
    if "media" in data and "media" not in request.FILES:
        raise ValidationError({"media": ["Choose a file to upload."]})
    if instance and data.get("revision") != instance.updated_at.isoformat():
        raise AdConflict("This ad changed since you opened it. Refresh before editing.")
    form = RewardedAdForm(data, request.FILES, instance=instance)
    if not form.is_valid():
        raise ValidationError({name: list(messages) for name, messages in form.errors.items()})
    return ad_data(form.save())


@never_cache
@api_view(["GET", "POST"])
@permission_classes([CanManageAds])
@parser_classes([MultiPartParser])
def manage_ads(request):
    if request.method == "POST":
        return Response(save_ad(request), status=201)
    return Response({"ads": [ad_data(ad) for ad in RewardedAd.objects.order_by("-id")],
                     "daily_limit": daily_limit(), "csrf_token": get_token(request)})


@never_cache
@api_view(["POST"])
@permission_classes([CanManageAds])
@parser_classes([MultiPartParser])
@transaction.atomic
def edit_ad(request, pk):
    instance = get_object_or_404(RewardedAd.objects.select_for_update(), pk=pk)
    return Response(save_ad(request, instance))


@never_cache
@api_view(["POST"])
@permission_classes([CanManageAds])
def update_policy(request):
    data = request.data
    if not isinstance(data, dict) or set(data) != {"daily_limit"}:
        raise ValidationError("Send only a daily limit.")
    limit = data["daily_limit"]
    if type(limit) is not int or not 1 <= limit <= 30:
        raise ValidationError({"daily_limit": ["Enter a whole number between 1 and 30."]})
    AdRewardPolicy.objects.update_or_create(pk=1, defaults={"daily_limit": limit})
    return Response({"daily_limit": limit})
