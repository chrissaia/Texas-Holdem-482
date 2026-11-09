"""Http endpoints, permission checks and response construction for friend requests, relationships and player discovery."""

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
    """Restrict friendship operations to active registered sessions."""
    message = "Sign in with a registered account to manage friends."


def friends_response(request, status_code=status.HTTP_200_OK):
    # Every write returns the full lists so the page can replace its state in one step.
    """Serialize the current friend lists with a CSRF token for subsequent writes."""
    payload = services.friends_payload(request.user)
    return Response({**payload, "csrf_token": get_token(request)}, status=status_code)


def require_empty_body(request):
    """Reject request bodies containing fields for actions that take no input."""
    if not isinstance(request.data, dict) or request.data:
        raise ValidationError({"non_field_errors": ["This action accepts an empty JSON object only."]})


def friends_view(methods):
    """Wrap a friend endpoint with registered-session permissions and cache prevention."""
    def decorate(view):
        """Apply the enclosing endpoint wrapper to the supplied view."""
        return never_cache(api_view(methods)(permission_classes([RegisteredPlayerPermission])(view)))
    return decorate


@ensure_csrf_cookie
@friends_view(["GET"])
def friend_list(request):
    """Return the authenticated player's friends and pending requests."""
    return friends_response(request)


@friends_view(["POST"])
def send_request(request):
    """Send request."""
    serializer = FriendRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        created = services.send_request(request.user, serializer.validated_data["username"])
    except services.FriendshipError as error:
        return Response({"non_field_errors": [str(error)]}, status=status.HTTP_400_BAD_REQUEST)
    return friends_response(request, status.HTTP_201_CREATED if created else status.HTTP_200_OK)


def request_action(action):
    """Build a protected endpoint that delegates a friendship action to its service."""
    @friends_view(["POST"])
    def view(request, pk):
        """Validate the action request, invoke its service and return the updated friend lists."""
        require_empty_body(request)
        action(request.user, pk)
        return friends_response(request)
    return view


accept_request = request_action(services.accept_request)
decline_request = request_action(services.decline_request)
cancel_request = request_action(services.cancel_request)


@friends_view(["DELETE"])
def remove_friend(request, pk):
    """Remove an accepted friendship owned by the current player."""
    services.remove_friend(request.user, pk)
    return friends_response(request)


@friends_view(["GET"])
def search_players(request):
    from django.contrib.auth import get_user_model
    from django.db.models.functions import Lower

    if set(request.query_params) - {"q"} or len(request.query_params.getlist("q")) > 1:
        raise ValidationError({"q": ["Supply a single search query only."]})
    query = request.query_params.get("q", "").strip()
    if len(query) > 150:
        raise ValidationError({"q": ["Use at most 150 characters."]})
    if not query:
        return Response({"results": []})
    players = (get_user_model().objects.filter(is_active=True, username__icontains=query)
               .exclude(pk=request.user.pk).order_by(Lower("username"), "pk")[:5])
    return Response({"results": [services.player(player) for player in players]})
