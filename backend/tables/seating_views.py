"""Private seat status and CSRF-protected buy-in actions."""
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import PokerTable, TableSeat
from .permissions import CanHostTable
from .seating import join_table, leave_table, _payload


class CanJoinTable(CanHostTable):
    message = "Sign in with a registered account to join a table."


@never_cache
@ensure_csrf_cookie
@api_view(["GET", "POST", "DELETE"])
@permission_classes([CanJoinTable])
def seat(request, pk):
    """Read, reserve, or release only the authenticated player's seat."""
    if request.method == "GET":
        table = get_object_or_404(PokerTable, pk=pk, is_public=True)
        current = TableSeat.objects.filter(user=request.user, table=table).first()
        payload = _payload(table, request.user, current)
        other = TableSeat.objects.filter(user=request.user).exclude(table=table).first()
        payload["other_table_id"] = other.table_id if other else None
    else:
        if not isinstance(request.data, dict) or request.data:
            raise ValidationError("Supply an empty JSON object; the server determines the buy-in.")
        action = join_table if request.method == "POST" else leave_table
        payload = {**action(pk, request.user.pk), "other_table_id": None}
    return Response({**payload, "csrf_token": get_token(request)})
