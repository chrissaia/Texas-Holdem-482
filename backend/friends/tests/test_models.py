"""Tests for friend requests, relationships and player discovery: models."""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from friends.models import Friendship

pytestmark = pytest.mark.django_db


@pytest.fixture
def alice():
    """Prepare alice for the surrounding test scenario."""
    return get_user_model().objects.create_user(username="alice", password="test-password-482")


@pytest.fixture
def bob():
    """Prepare bob for the surrounding test scenario."""
    return get_user_model().objects.create_user(username="bob", password="test-password-482")


def test_new_friendship_starts_pending(alice, bob):
    """Verify that new friendship starts pending."""
    friendship = Friendship.objects.create(from_user=alice, to_user=bob)
    assert friendship.status == Friendship.Status.PENDING
    assert friendship.created_at is not None
    assert str(friendship) == "alice -> bob (pending)"


def test_cannot_friend_yourself(alice):
    """Verify that cannot friend yourself."""
    with pytest.raises(IntegrityError), transaction.atomic():
        Friendship.objects.create(from_user=alice, to_user=alice)


def test_pair_is_unique_in_the_same_direction(alice, bob):
    """Verify that pair is unique in the same direction."""
    Friendship.objects.create(from_user=alice, to_user=bob)
    with pytest.raises(IntegrityError), transaction.atomic():
        Friendship.objects.create(from_user=alice, to_user=bob)


def test_pair_is_unique_in_the_opposite_direction(alice, bob):
    """Verify that pair is unique in the opposite direction."""
    Friendship.objects.create(from_user=alice, to_user=bob)
    with pytest.raises(IntegrityError), transaction.atomic():
        Friendship.objects.create(from_user=bob, to_user=alice)


def test_unknown_status_is_rejected(alice, bob):
    """Verify that unknown status is rejected."""
    with pytest.raises(IntegrityError), transaction.atomic():
        Friendship.objects.create(from_user=alice, to_user=bob, status="blocked")


def test_pair_can_ask_again_after_the_row_is_deleted(alice, bob):
    """Verify that pair can ask again after the row is deleted."""
    Friendship.objects.create(from_user=alice, to_user=bob).delete()
    Friendship.objects.create(from_user=bob, to_user=alice)
    assert Friendship.objects.count() == 1


def test_deleting_a_user_removes_their_friendships(alice, bob):
    """Verify that deleting a user removes their friendships."""
    Friendship.objects.create(from_user=alice, to_user=bob, status=Friendship.Status.ACCEPTED)
    bob.delete()
    assert not Friendship.objects.exists()
