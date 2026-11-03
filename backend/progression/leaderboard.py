"""All-time XP rankings from the authoritative event ledger (S18)."""
from django.contrib.auth import get_user_model
from django.db.models import BigIntegerField, F, Sum, Value, Window
from django.db.models.functions import Coalesce, Rank
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from tables.permissions import can_host
from tables.serializers import WholeNumberField


def ranked_accounts():
    return get_user_model().objects.filter(is_active=True).annotate(
        total_xp=Coalesce(Sum("event__xp"), Value(0), output_field=BigIntegerField()),
    )


class LeaderboardQuery(serializers.Serializer):
    page = WholeNumberField(required=False, min_value=1, max_value=2_147_483_647)
    page_size = WholeNumberField(required=False, min_value=1, max_value=50)

    def to_internal_value(self, data):
        errors = {}
        for key in data:
            if key not in self.fields:
                errors[key] = ["Unknown query parameter."]
            elif len(data.getlist(key)) != 1:
                errors[key] = ["Supply each parameter once."]
        if errors:
            raise serializers.ValidationError(errors)
        return super().to_internal_value(data)


def player_payload(player, viewer_id=None):
    return {
        "id": player.pk,
        "username": player.username,
        "avatar_url": player.avatar.url if player.avatar else None,
        "total_xp": player.total_xp,
        "rank": player.rank,
        "is_current_user": player.pk == viewer_id,
    }


class LeaderboardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


@method_decorator(never_cache, name="dispatch")
class LeaderboardView(ListAPIView):
    permission_classes = [AllowAny]
    pagination_class = LeaderboardPagination

    def list(self, request, *args, **kwargs):
        query = LeaderboardQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        # Rows share competition rank (1, 1, 3); IDs only stabilize pagination.
        accounts = ranked_accounts()
        ranked = accounts.annotate(rank=Window(Rank(), order_by=F("total_xp").desc())).order_by("-total_xp", "pk")
        page = self.paginate_queryset(ranked)
        viewer_id = request.user.pk if can_host(request) else None
        current_user = None
        if viewer_id:
            player = accounts.get(pk=viewer_id)
            player.rank = accounts.filter(total_xp__gt=player.total_xp).count() + 1
            current_user = player_payload(player, viewer_id)
        return Response({
            "count": self.paginator.page.paginator.count,
            "page": self.paginator.page.number,
            "page_size": self.paginator.get_page_size(request),
            "total_pages": self.paginator.page.paginator.num_pages,
            "period": "all_time",
            "current_user": current_user,
            "results": [player_payload(player, viewer_id) for player in page],
        })
