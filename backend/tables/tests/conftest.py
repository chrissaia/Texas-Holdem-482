"""Table-test fixtures. Seating requires the S3 disclaimer, so table tests start from an accepted account."""
import pytest
from django.utils import timezone


@pytest.fixture
def registered_user(registered_user):
    """The shared registered account, after accepting the play-money disclaimer."""
    registered_user.disclaimer_accepted_at = timezone.now()
    registered_user.save(update_fields=["disclaimer_accepted_at"])
    return registered_user
