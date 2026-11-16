"""Publish table-scoped game change signals after committed database updates."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction


def _group_name(table_id):
    return f"table_game_{table_id}"


def _publish_game_update(table_id):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        _group_name(table_id),
        {"type": "game.update"},
    )


def queue_game_update(table_id):
    """Notify connected players after the transaction commits successfully."""
    transaction.on_commit(
        lambda: _publish_game_update(table_id),
        robust=True,
    )
