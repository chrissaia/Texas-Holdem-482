from unittest.mock import patch

import pytest
from django.db import OperationalError
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_queries_postgresql():
    response = APIClient().get(reverse("health"))
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_unavailable_database_without_leaking_details():
    with patch("core.views.connection.cursor", side_effect=OperationalError("secret details")):
        response = APIClient().get(reverse("health"))
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable", "database": "unavailable"}


@pytest.mark.django_db
def test_health_rejects_mutation():
    assert APIClient().post(reverse("health"), {}).status_code == 405
