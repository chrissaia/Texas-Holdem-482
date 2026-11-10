"""Read-only, explicitly public table state for spectators (S26 integration boundary)."""
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .access import visible_tables
from .models import TableSeat


@never_cache
@api_view(["GET"])
@permission_classes([AllowAny])
def spectator_state(request, pk):
    """Return safe waiting-table state without reserving chips or changing occupancy/activity."""
    table = get_object_or_404(visible_tables(request.user).select_related("host"), pk=pk)
    seats = TableSeat.objects.filter(table=table).select_related("user").order_by("pk")
    return Response({
        "id": table.pk, "name": table.name, "status": table.status, "is_public": table.is_public,
        "host": {"id": table.host_id, "username": table.host.username},
        "max_players": table.max_players, "small_blind": table.small_blind, "big_blind": table.big_blind,
        "players": [{"id": seat.user_id, "username": seat.user.username, "stack": seat.stack} for seat in seats],
        "gameplay_available": False,
    })
