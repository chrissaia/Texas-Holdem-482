"""Authenticated WebSocket consumers for live poker-table change signals."""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from .gameplay import get_game_state
from .live_updates import _group_name


@database_sync_to_async
def _can_view_game(table_id, user):
    if not user.is_authenticated or not user.is_active or getattr(user, "is_guest", False):
        return False
    try:
        get_game_state(table_id, user.pk)
    except (Http404, PermissionDenied):
        return False
    return True


class GameUpdateConsumer(AsyncJsonWebsocketConsumer):
    """Send only a refresh signal; each player fetches their own private view."""

    async def connect(self):
        self.table_id = self.scope["url_route"]["kwargs"]["table_id"]
        if not await _can_view_game(self.table_id, self.scope["user"]):
            await self.close(code=4403)
            return

        self.group_name = _group_name(self.table_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.game_update({})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        await self.close(code=4400)

    async def game_update(self, event):
        if not await _can_view_game(self.table_id, self.scope["user"]):
            await self.close(code=4403)
            return
        await self.send_json({"type": "game.updated"})
