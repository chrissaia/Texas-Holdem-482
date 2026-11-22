from io import BytesIO

import pytest
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from profiles.models import RewardedAd

pytestmark = pytest.mark.django_db
MANAGE = "/api/profile/ads/manage/"
CATALOG = "/api/profile/ads/"
CONTEXT = "/api/tables/creation-context/"


def picture(name="club.png"):
    buffer = BytesIO()
    Image.new("RGB", (20, 20), "navy").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def fields(**overrides):
    return {"title": "Poker Club", "kind": "image", "view_seconds": 5, "reward": 75, **overrides}


def test_permissions_and_navigation(registered_client, guest_client, rivr_admin_client, rivr_admin):
    for player in (APIClient(), guest_client, registered_client):
        assert not player.get(CONTEXT).data["can_manage_ads"]
        assert player.get(MANAGE).status_code == 403
        assert player.post(MANAGE, fields(), format="multipart").status_code == 403
        assert player.post(MANAGE + "policy/", {"daily_limit": 1}, format="json").status_code == 403
    assert rivr_admin_client.get(CONTEXT).data["can_manage_ads"]
    rivr_admin.is_superuser = False
    rivr_admin.save(update_fields=["is_superuser"])
    assert rivr_admin_client.get(MANAGE).status_code == 403
    rivr_admin.user_permissions.set(Permission.objects.filter(content_type__app_label="profiles",
        codename__in=["add_rewardedad", "change_rewardedad", "add_adrewardpolicy", "change_adrewardpolicy"]))
    assert rivr_admin_client.get(MANAGE).status_code == 200


def test_create_publish_replace_and_unpublish(rivr_admin_client, registered_client, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    response = rivr_admin_client.post(MANAGE, fields(media=picture()), format="multipart")
    assert response.status_code == 201, response.data
    ad = response.data
    assert not ad["active"]
    assert registered_client.get(CATALOG).data["ads"] == []
    route = f"{MANAGE}{ad['id']}/"
    response = rivr_admin_client.post(route,
        fields(active="on", revision=ad["revision"], media=picture("replacement.png"), reward=125),
        format="multipart")
    assert response.status_code == 200, response.data
    published = response.data
    assert published["media_url"] != ad["media_url"]
    assert (tmp_path / RewardedAd.objects.get().media.name).read_bytes().startswith(b"\x89PNG")
    row = registered_client.get(CATALOG).data["ads"][0]
    assert row["reward"] == 125 and row["media_url"] == published["media_url"]
    assert rivr_admin_client.post(route, fields(revision=ad["revision"]), format="multipart").status_code == 409
    response = rivr_admin_client.post(route, fields(revision=published["revision"]), format="multipart")
    assert response.status_code == 200
    assert response.data["media_url"] == published["media_url"]
    assert registered_client.get(CATALOG).data["ads"] == []
    result = rivr_admin_client.get(MANAGE)
    assert "no-store" in result["Cache-Control"]
    assert result.data["ads"][0]["id"] == ad["id"]


def test_media_validation_and_csrf(rivr_admin_client):
    assert rivr_admin_client.post(MANAGE, fields(media="https://example.com/x"), format="multipart").status_code == 400
    invalid = rivr_admin_client.post(MANAGE, fields(media=SimpleUploadedFile("bad.png", b"bad")), format="multipart")
    assert invalid.status_code == 400 and "media" in invalid.data
    assert rivr_admin_client.post(MANAGE, fields(title=["one", "two"]), format="multipart").status_code == 400
    assert not RewardedAd.objects.exists()
    rivr_admin_client.credentials()
    assert rivr_admin_client.post(MANAGE, fields(media=picture()), format="multipart").status_code == 403
    assert rivr_admin_client.post(MANAGE + "1/", fields(), format="multipart").status_code == 403


def test_policy_updates_player_limit(rivr_admin_client, registered_client):
    endpoint = MANAGE + "policy/"
    for payload in ({}, {"daily_limit": True}, {"daily_limit": 31}, {"daily_limit": "5"}):
        assert rivr_admin_client.post(endpoint, payload, format="json").status_code == 400
    assert rivr_admin_client.post(endpoint, {"daily_limit": 2}, format="json").data == {"daily_limit": 2}
    assert registered_client.get(CATALOG).data["daily_limit"] == 2
    rivr_admin_client.credentials()
    assert rivr_admin_client.post(endpoint, {"daily_limit": 4}, format="json").status_code == 403
