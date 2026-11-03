from django.db.models import Sum
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from profiles.views import RegisteredAccountPermission
from .catalog import ACHIEVEMENTS, ACHIEVEMENT_XP
from .models import Achievement, Event


@never_cache
@api_view(["GET"])
@permission_classes([RegisteredAccountPermission])
def collection(request):
    # One SQL snapshot supplies both XP and awards; no client claims or writes.
    from django.db import transaction
    from django.contrib.auth import get_user_model
    with transaction.atomic():
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        earned = list(Achievement.objects.filter(user=request.user).order_by("earned_at", "pk"))
        total = Event.objects.filter(user=request.user).aggregate(value=Sum("xp"))["value"] or 0
    return Response({
        "total_xp": total, "total_achievements": len(ACHIEVEMENTS),
        "earned": [{"code": a.code, "name": ACHIEVEMENTS[a.code][0],
                    "description": ACHIEVEMENTS[a.code][1], "xp": ACHIEVEMENT_XP,
                    "earned_at": a.earned_at} for a in earned],
    })
