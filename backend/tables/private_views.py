"""Private table discovery, creation and host-controlled friend invitations (S27)."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from friends.models import Friendship
from progression.services import record_event
from .access import visible_tables
from .models import PokerTable, TableInvitation, TableSeat
from .permissions import CanHostTable
from .serializers import TableSerializer, WholeNumberField
from .seating import SeatingConflict


@never_cache
@ensure_csrf_cookie
@api_view(["GET", "POST"])
@permission_classes([CanHostTable])
def private_tables(request):
    """Create a private table or list only the caller's hosted/invited private tables."""
    if request.method == "GET":
        tables = visible_tables(request.user).filter(is_public=False).exclude(status="closed").select_related("host")
        return Response({"results": TableSerializer(tables, many=True).data, "csrf_token": get_token(request)})
    serializer = TableSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        table = serializer.save(host=request.user, is_public=False)
        record_event(request.user.pk, "game", str(table.pk))
    return Response(TableSerializer(table).data, status=201)


@never_cache
@ensure_csrf_cookie
@api_view(["GET", "POST", "DELETE"])
@permission_classes([CanHostTable])
def invitations(request, pk):
    """Let the host invite accepted friends or revoke access before a player takes a seat."""
    with transaction.atomic():
        table = get_object_or_404(PokerTable.objects.select_for_update(), pk=pk, host=request.user, is_public=False)
        if request.method != "GET":
            if not isinstance(request.data, dict) or set(request.data) != {"user_id"}:
                raise ValidationError({"user_id": ["Supply exactly one user_id."]})
            user_id = WholeNumberField(min_value=1).run_validation(request.data["user_id"])
            target = get_object_or_404(get_user_model(), pk=user_id, is_active=True)
            if request.method == "POST":
                if table.status == "closed":
                    raise SeatingConflict("This table is closed.")
                if not Friendship.objects.filter(status="accepted").filter(
                    Q(from_user=request.user, to_user=target) | Q(from_user=target, to_user=request.user)
                ).exists():
                    raise ValidationError({"user_id": ["Invite someone from your accepted friends list."]})
                TableInvitation.objects.get_or_create(table=table, user=target)
            else:
                if TableSeat.objects.filter(table=table, user=target).exists():
                    raise SeatingConflict("This player must leave the table before access can be revoked.")
                TableInvitation.objects.filter(table=table, user=target).delete()
        rows = TableInvitation.objects.filter(table=table).select_related("user").order_by("user__username", "pk")
        return Response({"results": [{"id": row.user_id, "username": row.user.username} for row in rows],
                         "csrf_token": get_token(request)})
