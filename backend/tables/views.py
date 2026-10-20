from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import CreateAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import PokerTable
from .permissions import CanHostTable, can_host
from .serializers import TableSerializer


class TableCreateView(CreateAPIView):
    serializer_class = TableSerializer
    permission_classes = [CanHostTable]

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)


class TableDetailView(RetrieveAPIView):
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
    return Response({"host": host, "csrf_token": get_token(request)})
