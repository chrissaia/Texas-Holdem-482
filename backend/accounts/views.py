from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import GuestSerializer, LoginSerializer, RegistrationSerializer
from .services import clear_guest, register_user, session_payload, start_guest

INVALID_LOGIN = "Invalid username or password."


class CsrfSessionAuthentication(SessionAuthentication):
    """DRF skips CSRF for anonymous requests; auth endpoints must check it anyway."""

    def authenticate(self, request):
        self.enforce_csrf(request)
        return super().authenticate(request)


def auth_view(methods):
    def decorate(view):
        view = permission_classes([AllowAny])(view)
        view = authentication_classes([CsrfSessionAuthentication])(view)
        return never_cache(api_view(methods)(view))
    return decorate


def session_response(request, status_code=status.HTTP_200_OK):
    # Login/logout rotate the CSRF token, so every response returns the current one.
    return Response({**session_payload(request), "csrf_token": get_token(request)}, status=status_code)


def error(message, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"non_field_errors": [message]}, status=status_code)


@ensure_csrf_cookie
@auth_view(["GET"])
def session(request):
    return session_response(request)


@auth_view(["POST"])
def register(request):
    if request.user.is_authenticated:
        return error("Log out before creating another account.")
    serializer = RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        user = register_user(**serializer.validated_data)
    except IntegrityError:
        # A simultaneous registration claimed the name or email after validation.
        return Response(
            {"non_field_errors": ["That username or email was just taken. Try again."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    clear_guest(request.session)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return session_response(request, status.HTTP_201_CREATED)


@auth_view(["POST"])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    match = get_user_model().objects.filter(username__iexact=username).first()
    # Unknown usernames still run the password hasher, so timing reveals nothing.
    user = authenticate(
        request,
        username=match.username if match else username,
        password=serializer.validated_data["password"],
    )
    if user is None:
        return error(INVALID_LOGIN)
    clear_guest(request.session)
    login(request, user)
    return session_response(request)


@auth_view(["POST"])
def logout_view(request):
    # flush() deletes the server-side session, so the old cookie stops working.
    logout(request)
    return session_response(request)


@auth_view(["POST"])
def guest(request):
    if request.user.is_authenticated:
        return error("Log out before continuing as a guest.")
    serializer = GuestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    start_guest(request.session, serializer.validated_data["name"])
    return session_response(request, status.HTTP_201_CREATED)
