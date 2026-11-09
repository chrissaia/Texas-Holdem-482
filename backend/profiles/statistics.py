"""Private S17 statistics derived from trusted, unique completed-hand events."""
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Count, Q
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from progression.models import Event
from .views import RegisteredAccountPermission


@never_cache
@api_view(["GET"])
@permission_classes([RegisteredAccountPermission])
def statistics(request):
    """Read the session account's all-time hand results in one aggregate query."""
    if request.query_params:
        raise ValidationError("Statistics are for your signed-in account and all time; no filters are supported.")
    counts = Event.objects.filter(user=request.user, kind="hand").aggregate(
        hands_played=Count("pk"),
        hands_won=Count("pk", filter=Q(outcome="win")),
        hands_lost=Count("pk", filter=Q(outcome="loss")),
        hands_split=Count("pk", filter=Q(outcome="split")),
    )
    played = counts["hands_played"]
    rate = (Decimal(counts["hands_won"]) * 100 / played).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP,
    ) if played else Decimal("0.0")
    return Response({
        "username": request.user.username, "period": "all_time", **counts,
        "win_rate": float(rate),
    })
