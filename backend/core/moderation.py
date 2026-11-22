"""S28 staff-only moderation with chip-safe transitions and atomic audit records."""
import json

from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from tables.models import PokerTable, TableSeat


class Conflict(APIException):
    status_code = 409
    default_detail = "This record changed. Refresh and try again."


def require(user, *permissions):
    if not user.is_active or not user.is_staff or not user.has_perms(permissions):
        raise PermissionDenied("You do not have permission to manage these records.")


class Query(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True, max_length=80, default="")
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)
    state = serializers.ChoiceField(choices=["all", "active", "suspended", "waiting", "playing", "closed"], default="all")


def query(request, states):
    if set(request.query_params) - {"q", "page", "state"} or any(
        len(request.query_params.getlist(key)) != 1 for key in request.query_params
    ):
        raise ValidationError("Unknown or repeated query parameters.")
    form = Query(data=request.query_params)
    form.is_valid(raise_exception=True)
    if form.validated_data["state"] not in states:
        raise ValidationError("Unsupported status filter.")
    return form.validated_data


def page_data(rows, page, serialize):
    size = 20
    count = rows.count()
    return {"count": count, "page": page, "page_size": size,
            "results": [serialize(row) for row in rows[(page - 1) * size:page * size]]}


def user_data(user):
    # Deliberately omit email, passwords and account wallets.
    return {"id": user.pk, "username": user.username, "is_active": user.is_active,
            "is_admin": user.is_staff or user.is_superuser,
            "date_joined": user.date_joined}


def table_data(table):
    return {"id": table.pk, "name": table.name, "host": table.host.username,
            "status": table.status, "is_public": table.is_public,
            "player_count": table.player_count, "max_players": table.max_players,
            "buy_in": table.buy_in, "last_activity_at": table.last_activity_at}


def audit(actor, target, action, before, after, reason):
    LogEntry.objects.create(user=actor, content_type=ContentType.objects.get_for_model(target),
                            object_id=str(target.pk), object_repr=str(target)[:200], action_flag=CHANGE,
                            change_message=json.dumps({"s28": True, "action": action,
                                                       "before": before, "after": after, "reason": reason}))


@method_decorator(never_cache, name="dispatch")
class StaffView(APIView):
    permission_classes = [IsAdminUser]


class ContextView(StaffView):
    def get(self, request):
        user = request.user
        return Response({"username": user.username, "csrf_token": get_token(request),
                         "can_view_users": user.has_perm("accounts.view_user"),
                         "can_change_users": user.has_perms(["accounts.view_user", "accounts.change_user"]),
                         "can_view_tables": user.has_perm("tables.view_pokertable"),
                         "can_change_tables": user.has_perms(["tables.view_pokertable", "tables.change_pokertable"]),
                         "can_view_audit": user.has_perm("admin.view_logentry")})


class UsersView(StaffView):
    def get(self, request):
        require(request.user, "accounts.view_user")
        values = query(request, {"all", "active", "suspended"})
        rows = get_user_model().objects.filter(username__icontains=values["q"]).order_by("username", "pk")
        if values["state"] != "all":
            rows = rows.filter(is_active=values["state"] == "active")
        return Response(page_data(rows, values["page"], user_data))


class TablesView(StaffView):
    def get(self, request):
        require(request.user, "tables.view_pokertable")
        values = query(request, {"all", "waiting", "playing", "closed"})
        rows = PokerTable.objects.select_related("host").filter(
            Q(name__icontains=values["q"]) | Q(host__username__icontains=values["q"])
        ).order_by("-created_at", "-pk")
        if values["state"] != "all":
            rows = rows.filter(status=values["state"])
        return Response(page_data(rows, values["page"], table_data))


class Change(serializers.Serializer):
    action = serializers.CharField()
    expected = serializers.CharField()
    reason = serializers.CharField(min_length=3, max_length=300)


def change_data(request):
    if not isinstance(request.data, dict) or set(request.data) != {"action", "expected", "reason"}:
        raise ValidationError("Send exactly action, expected and reason.")
    if request.query_params:
        raise ValidationError("Query parameters are not supported for changes.")
    form = Change(data=request.data)
    form.is_valid(raise_exception=True)
    return form.validated_data


class UserActionView(StaffView):
    @transaction.atomic
    def post(self, request, pk):
        require(request.user, "accounts.view_user", "accounts.change_user")
        values = change_data(request)
        if values["action"] not in {"suspend", "reactivate"}:
            raise ValidationError("Choose suspend or reactivate.")
        user = get_object_or_404(get_user_model().objects.select_for_update(), pk=pk)
        if user.pk == request.user.pk or user.is_staff or user.is_superuser:
            raise Conflict("Your own account and administrator accounts are protected.")
        before = "active" if user.is_active else "suspended"
        if values["expected"] != before:
            raise Conflict()
        after = "suspended" if values["action"] == "suspend" else "active"
        if before == after:
            raise Conflict("The account already has that status.")
        # Seating also holds this account lock. A concurrent join either completes
        # first (and blocks suspension), or observes the inactive account afterward.
        if TableSeat.objects.filter(user=user).exists():
            raise Conflict("This player has reserved table chips. They must leave the table first.")
        user.is_active = after == "active"
        user.save(update_fields=["is_active"])
        audit(request.user, user, values["action"], before, after, values["reason"])
        return Response(user_data(user))


class TableActionView(StaffView):
    @transaction.atomic
    def post(self, request, pk):
        require(request.user, "tables.view_pokertable", "tables.change_pokertable")
        values = change_data(request)
        if values["action"] not in {"close", "reopen"}:
            raise ValidationError("Choose close or reopen.")
        table = get_object_or_404(PokerTable.objects.select_for_update(), pk=pk)
        if values["expected"] != table.status:
            raise Conflict()
        if table.status == "playing" or table.player_count or table.seats.exists():
            raise Conflict("Only empty tables outside play can be closed or reopened.")
        before = table.status
        after = "closed" if values["action"] == "close" else "waiting"
        if before == after:
            raise Conflict("The table already has that status.")
        table.status = after
        table.last_activity_at = timezone.now()
        table.save(update_fields=["status", "last_activity_at"])
        audit(request.user, table, values["action"], before, after, values["reason"])
        return Response(table_data(table))


class AuditView(StaffView):
    def get(self, request):
        require(request.user, "admin.view_logentry")
        values = query(request, {"all"})
        rows = LogEntry.objects.select_related("user").filter(
            change_message__startswith='{"s28": true,').filter(
            Q(object_repr__icontains=values["q"]) | Q(user__username__icontains=values["q"])
        ).order_by("-action_time", "-pk")
        def serialize(row):
            return {"id": row.pk, "actor": row.user.username, "target": row.object_repr,
                    "target_id": row.object_id, "created_at": row.action_time,
                    **json.loads(row.change_message)}
        return Response(page_data(rows, values["page"], serialize))
