"""S21 endpoints. All require an active registered session; writes enforce CSRF."""

from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.serializers import StrictSerializer
from tables.permissions import CanHostTable

from . import services
from .models import MAX_LENGTH


class RegisteredPlayer(CanHostTable):
    message = "Sign in with a registered account to use messages."


class MessageSerializer(StrictSerializer):
    body = serializers.CharField(max_length=MAX_LENGTH, trim_whitespace=True, allow_blank=False)


def message_view(methods):
    def decorate(view):
        return never_cache(ensure_csrf_cookie(api_view(methods)(permission_classes([RegisteredPlayer])(view))))
    return decorate


def after_param(request):
    """Optional ?after=<message id> for polling. Anything else in the query string is refused."""
    params = request.query_params
    if set(params) - {"after"} or len(params.getlist("after")) > 1:
        raise ValidationError({"non_field_errors": ["Only one optional 'after' parameter is allowed."]})
    raw = params.get("after")
    if raw is None:
        return None
    if not raw.isdigit():
        raise ValidationError({"after": ["Use a whole message ID."]})
    return int(raw)


def body_param(request):
    serializer = MessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data["body"]


def send(request, action, *args):
    try:
        message = action(request.user, *args, body_param(request))
    except services.MessagingError as error:
        return Response({"non_field_errors": [str(error)]}, status=error.status)
    return Response({"message": message, "csrf_token": get_token(request)}, status=status.HTTP_201_CREATED)


@message_view(["GET"])
def conversation_list(request):
    if request.query_params:
        raise ValidationError({"non_field_errors": ["This list takes no parameters."]})
    return Response({**services.conversations(request.user), "csrf_token": get_token(request)})


@message_view(["GET", "POST"])
def conversation(request, friend_id):
    if request.method == "POST":
        return send(request, services.send_direct_message, friend_id)
    payload = services.conversation(request.user, friend_id, after_param(request))
    return Response({**payload, "csrf_token": get_token(request)})


@message_view(["GET", "POST"])
def table_chat(request, table_id):
    if request.method == "POST":
        return send(request, services.send_table_message, table_id)
    payload = services.table_chat(request.user, table_id, after_param(request))
    return Response({**payload, "csrf_token": get_token(request)})
