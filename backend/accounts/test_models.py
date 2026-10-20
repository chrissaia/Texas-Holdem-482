import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_custom_user_persists_hashed_password():
    user_model = get_user_model()
    user = user_model.objects.create_user(username="foundation-test", password="test-password-123")
    stored = user_model.objects.get(pk=user.pk)
    assert stored.check_password("test-password-123")
    assert stored.password != "test-password-123"
    assert not stored.is_staff
    assert not stored.is_superuser
