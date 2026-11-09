"""Http endpoints, permission checks and response construction for public poker-table configuration and browsing."""

from django.middleware.csrf import get_token
from django.db import transaction
from progression.services import record_event
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import Coalesce, Lower
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import ListCreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PokerTable
from .permissions import CanHostTable, can_host
from .serializers import TableListQuerySerializer, TableSerializer
from .pagination import TablePagination


class TableListCreateView(ListCreateAPIView):
    """List public active tables or create a table owned by the authenticated host."""
    serializer_class = TableSerializer
    pagination_class = TablePagination

    def get_permissions(self):
        """Return permissions for the caller."""
        permission = CanHostTable if self.request.method == "POST" else AllowAny
        return [permission()]

    def get_queryset(self):
        """Build the filtered database query used by this endpoint."""
        params = TableListQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        filters = params.validated_data
        tables = PokerTable.objects.filter(is_public=True).exclude(status="closed")
        # These totals describe the whole public lobby, independent of filters/pages.
        self.lobby_totals = tables.aggregate(
            total_tables=Count("pk"), total_players=Coalesce(Sum("player_count"), 0)
        )
        if filters.get("search"):
            term = filters["search"]
            tables = tables.filter(Q(name__icontains=term) | Q(host__username__icontains=term))
        if "max_buy_in" in filters:
            tables = tables.filter(buy_in__lte=filters["max_buy_in"])
        if "big_blind" in filters:
            tables = tables.filter(big_blind=filters["big_blind"])
        if "max_players" in filters:
            tables = tables.filter(max_players=filters["max_players"])
        if filters.get("available_seats") == "true":
            tables = tables.filter(player_count__lt=F("max_players"))
        if "status" in filters:
            tables = tables.filter(status=filters["status"])
        orderings = {
            "newest": ("-created_at", "-id"),
            "name": ("sort_name", "id"),
            "buy_in": ("buy_in", "id"),
            "-buy_in": ("-buy_in", "id"),
            "blinds": ("big_blind", "id"),
            "players": ("-player_count", "id"),
        }
        return tables.select_related("host").annotate(sort_name=Lower("name")).order_by(
            *orderings[filters["ordering"]]
        )

    @transaction.atomic
    def perform_create(self, serializer):
        """Save a validated table with ownership derived from the authenticated request."""
        table = serializer.save(host=self.request.user)
        record_event(self.request.user.pk, "game", str(table.pk))


class TableDetailView(RetrieveAPIView):
    """Retrieve public table settings without exposing private tables."""
    serializer_class = TableSerializer
    permission_classes = [AllowAny]
    queryset = PokerTable.objects.filter(is_public=True).select_related("host")


@never_cache
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def creation_context(request):
    """Minimal identity/CSRF contract for this form, not a login implementation."""
    host = None
    if can_host(request):
        host = {"id": request.user.pk, "username": request.user.username}
    summary = None
    if host:
        summary = {"avatar_url": request.user.avatar.url if request.user.avatar else None,
                   "chip_balance": request.user.chip_balance}
    return Response({"host": host, "csrf_token": get_token(request), "profile_summary": summary})
