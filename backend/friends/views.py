from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from tables.permissions import CanHostTable
from . import services
from .serializers import FriendRequestSerializer


class RegisteredPlayerPermission(CanHostTable):
    message = "Sign in with a registered account to manage friends."


def friends_response(request, status_code=status.HTTP_200_OK):
    # Every write returns the full lists so the page can replace its state in one step.
    payload = services.friends_payload(request.user)
    return Response({**payload, "csrf_token": get_token(request)}, status=status_code)


def require_empty_body(request):
    if not isinstance(request.data, dict) or request.data:
        raise ValidationError({"non_field_errors": ["This action accepts an empty JSON object only."]})


def friends_view(methods):
    def decorate(view):
        return never_cache(api_view(methods)(permission_classes([RegisteredPlayerPermission])(view)))
    return decorate


@ensure_csrf_cookie
@friends_view(["GET"])
def friend_list(request):
    return friends_response(request)


@friends_view(["POST"])
def send_request(request):
    serializer = FriendRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        created = services.send_request(request.user, serializer.validated_data["username"])
    except services.FriendshipError as error:
        return Response({"non_field_errors": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)
    return friends_response(request, status.HTTP_201_CREATED if created else status.HTTP_200_OK)


def request_action(action):
    @friends_view(["POST"])
    def view(request, pk):
        require_empty_body(request)
        action(request.user, pk)
        return friends_response(request)
    return view


accept_request = request_action(services.accept_request)
decline_request = request_action(services.decline_request)
cancel_request = request_action(services.cancel_request)


@friends_view(["DELETE"])
def remove_friend(request, pk):
    services.remove_friend(request.user, pk)
    return friends_response(request)
