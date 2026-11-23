from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import override_settings
from django.utils import timezone
import pytest

from config.asgi import application
from tables.gameplay import apply_game_action
from tables.models import PokerHand, PokerTable
from tables.seating import join_table


pytestmark = pytest.mark.django_db(transaction=True)

IN_MEMORY_CHANNEL_LAYER = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}


def create_game(max_players=2):
    User = get_user_model()
    users = [
        User.objects.create_user(
            username=f"live-player-{index}", chip_balance=1_000, disclaimer_accepted_at=timezone.now()
        )
        for index in range(2)
    ]
    table = PokerTable.objects.create(
        name="Live game test",
        host=users[0],
        max_players=max_players,
        buy_in=100,
        minimum_balance=100,
        small_blind=5,
        big_blind=10,
    )
    for user in users:
        join_table(table.pk, user.pk)
    return table, users


def test_committed_game_action_notifies_players_without_sharing_private_state():
    table, users = create_game()

    async def exercise():
        path = f"/ws/tables/{table.pk}/game/"
        communicators = []
        for user in users:
            communicator = WebsocketCommunicator(
                application,
                path,
                headers=[(b"origin", b"http://localhost:5173")],
            )
            communicator.scope["user"] = user
            connected, _ = await communicator.connect()
            assert connected
            assert await communicator.receive_json_from() == {"type": "game.updated"}
            communicators.append(communicator)

        actor_id = await database_sync_to_async(
            lambda: PokerHand.objects.get(
                table_id=table.pk,
                status=PokerHand.Status.ACTIVE,
            ).turn_user_id
        )()
        await database_sync_to_async(apply_game_action)(table.pk, actor_id, "fold")

        for communicator in communicators:
            update = await communicator.receive_json_from(timeout=2)
            assert update == {"type": "game.updated"}
            await communicator.disconnect()

    async_to_sync(exercise)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_new_seat_notifies_players_already_connected_to_the_table():
    table, users = create_game(max_players=4)
    late_user = get_user_model().objects.create_user(
        username="live-late-player",
        chip_balance=1_000,
        disclaimer_accepted_at=timezone.now(),
    )

    async def exercise():
        communicator = WebsocketCommunicator(
            application,
            f"/ws/tables/{table.pk}/game/",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        communicator.scope["user"] = users[0]
        connected, _ = await communicator.connect()
        assert connected
        assert await communicator.receive_json_from() == {"type": "game.updated"}

        await database_sync_to_async(join_table)(table.pk, late_user.pk)

        assert await communicator.receive_json_from(timeout=2) == {
            "type": "game.updated",
        }
        await communicator.disconnect()

    async_to_sync(exercise)()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_CHANNEL_LAYER)
def test_websocket_rejects_anonymous_and_unseated_users():
    table, _ = create_game()
    outsider = get_user_model().objects.create_user(
        username="live-outsider",
        chip_balance=1_000,
    )

    async def exercise(user):
        communicator = WebsocketCommunicator(
            application,
            f"/ws/tables/{table.pk}/game/",
            headers=[(b"origin", b"http://localhost:5173")],
        )
        communicator.scope["user"] = user
        connected, close_code = await communicator.connect()
        assert not connected
        assert close_code == 4403

    async_to_sync(exercise)(AnonymousUser())
    async_to_sync(exercise)(outsider)
