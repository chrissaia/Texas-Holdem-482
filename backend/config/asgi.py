"""ASGI entry point for HTTP and authenticated poker-game WebSockets."""

import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_asgi_app = get_asgi_application()

from django.urls import path

from tables.consumers import GameUpdateConsumer

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter([
                path(
                    "ws/tables/<int:table_id>/game/",
                    GameUpdateConsumer.as_asgi(),
                ),
            ])
        )
    ),
})
