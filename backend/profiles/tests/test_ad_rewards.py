from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
from threading import Barrier
from unittest.mock import patch

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from PIL import Image
from rest_framework.test import APIClient

from profiles.ad_rewards import DAILY_LIMIT
from profiles.ad_forms import RewardedAdForm
from profiles.models import AdRewardPolicy, AdView, RewardedAd
from profiles.rewards import MAX_BALANCE

pytestmark = pytest.mark.django_db
BASE = "/api/profile/ads/"
NOW = datetime(2026, 11, 22, 12, tzinfo=timezone.utc)


@pytest.fixture
def catalog():
    return [RewardedAd.objects.create(title=f"Ad {i}", kind="image", media="rewarded-ads/ad.png",
                                      reward=75, view_seconds=5, active=True)
            for i in range(DAILY_LIMIT + 1)]


def post(client, route, now=NOW, payload=None):
    with patch("profiles.ad_rewards.timezone.now", return_value=now):
        return client.post(BASE + route, {} if payload is None else payload, format="json")


def begin(client, ad, now=NOW):
    response = post(client, f"{ad.pk}/start/", now)
    assert response.status_code == 200, response.data
    return f"claim/{response.data['token']}/"


def test_catalog_and_identity(registered_client, guest_client, catalog):
    catalog[0].active = False
    catalog[0].save()
    for client in (APIClient(), guest_client):
        assert client.get(BASE).status_code == 403
        assert post(client, f"{catalog[1].pk}/start/").status_code == 403
    response = registered_client.get(BASE)
    assert "no-store" in response["Cache-Control"]
    assert response.data["csrf_token"]
    assert response.data["remaining"] == DAILY_LIMIT
    assert {ad["id"] for ad in response.data["ads"]} == {ad.pk for ad in catalog[1:]}
    assert post(registered_client, f"{catalog[0].pk}/start/").status_code == 404


def test_claim_time_ownership_replay_and_balance(registered_client, registered_user, rivr_admin_client, catalog):
    started = begin(registered_client, catalog[0])
    assert post(rivr_admin_client, started, NOW + timedelta(seconds=5)).status_code == 404
    assert post(registered_client, started, NOW + timedelta(seconds=4)).status_code == 409
    for seconds in (5, 6):
        result = post(registered_client, started, NOW + timedelta(seconds=seconds))
        assert result.status_code == 200
        assert result.data["awarded"] == 75
        assert result.data["profile"]["chip_balance"] == 75
    assert registered_client.get("/api/profile/").data["chip_balance"] == 75
    assert AdView.objects.filter(user=registered_user, completed_at__isnull=False).count() == 1
    assert post(registered_client, f"{catalog[0].pk}/start/").status_code == 409


def test_daily_limit_and_reset(registered_client, catalog):
    for ad in catalog[:DAILY_LIMIT]:
        assert post(registered_client, begin(registered_client, ad), NOW + timedelta(seconds=5)).status_code == 200
    assert post(registered_client, f"{catalog[-1].pk}/start/").status_code == 409
    with patch("profiles.ad_rewards.timezone.now", return_value=NOW):
        assert registered_client.get(BASE).data["remaining"] == 0
    assert begin(registered_client, catalog[0], NOW + timedelta(days=1))


def test_admin_can_configure_limit_and_lower_it_during_playback(
        rivr_admin_client, registered_client, catalog):
    url = "/admin/profiles/adrewardpolicy/"
    assert rivr_admin_client.post(url + "add/", {"daily_limit": 2, "_save": "Save"}).status_code == 302
    assert AdRewardPolicy.objects.get().daily_limit == 2
    start = begin(registered_client, catalog[0])
    assert post(registered_client, start, NOW + timedelta(seconds=5)).status_code == 200
    next_start = begin(registered_client, catalog[1])
    assert rivr_admin_client.post(url + "1/change/", {"daily_limit": 1, "_save": "Save"}).status_code == 302
    assert post(registered_client, next_start, NOW + timedelta(seconds=5)).status_code == 409
    assert not AdView.objects.filter(ad=catalog[1], completed_at__isnull=False).exists()


@pytest.mark.parametrize("invalidated", ["restart", "another ad", "expired", "midnight", "edited", "disabled"])
def test_invalidated_playback(invalidated, registered_client, catalog):
    ad = catalog[0]
    now = NOW.replace(hour=23, minute=59, second=58) if invalidated == "midnight" else NOW
    started = begin(registered_client, ad, now)
    claim_time = now + timedelta(seconds=5)
    if invalidated in {"restart", "another ad"}:
        begin(registered_client, ad if invalidated == "restart" else catalog[1], now)
    if invalidated == "expired":
        claim_time = now + timedelta(minutes=15)
    if invalidated in {"edited", "disabled"}:
        ad.reward = 500
        ad.active = invalidated != "disabled"
        ad.save()
    result = post(registered_client, started, claim_time)
    assert result.status_code == (404 if invalidated in {"restart", "another ad"} else 409)
    assert not AdView.objects.filter(completed_at__isnull=False).exists()


def test_csrf_untrusted_input_and_balance_limit(registered_client, registered_user, catalog):
    ad = catalog[0]
    start = f"{ad.pk}/start/"
    assert post(registered_client, start, payload={"reward": 999}).status_code == 400
    started = begin(registered_client, ad)
    assert post(registered_client, started, payload={"watched": True}).status_code == 400
    registered_user.chip_balance = MAX_BALANCE
    registered_user.save(update_fields=["chip_balance"])
    assert post(registered_client, started, NOW + timedelta(seconds=5)).status_code == 409
    assert not AdView.objects.filter(completed_at__isnull=False).exists()
    registered_client.credentials()
    assert post(registered_client, started, NOW + timedelta(seconds=5)).status_code == 403


@pytest.mark.parametrize("kind, filename, content, valid", [
    ("image", "poster.png", None, True),
    ("image", "poster.jpg", None, False),
    ("image", "poster.png", b"bad", False),
    ("video", "spot.mp4", b"\x00\x00\x00\x18ftypmp42", True),
    ("video", "spot.webm", bytes.fromhex("1a45dfa3"), True),
    ("video", "spot.mp4", b"bad", False),
    ("video", "spot.html", b"\x00\x00\x00\x18ftypmp42", False),
])
def test_upload_validation(kind, filename, content, valid):
    if content is None:
        buffer = BytesIO()
        Image.new("RGB", (20, 20)).save(buffer, "PNG")
        content = buffer.getvalue()
    form = RewardedAdForm({"title": "Example", "kind": kind, "reward": 75, "view_seconds": 5},
                          {"media": SimpleUploadedFile(filename, content)})
    assert form.is_valid() is valid


def test_admin_upload_and_replace(registered_client, rivr_admin_client, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    url = "/admin/profiles/rewardedad/add/"
    assert registered_client.get(url).status_code == 302
    buffer = BytesIO()
    Image.new("RGB", (20, 20)).save(buffer, "PNG")
    data = {"title": "Real uploaded poster", "kind": "image", "reward": 75,
            "view_seconds": 5, "active": "on", "_save": "Save"}
    response = rivr_admin_client.post(url, {**data, "media": SimpleUploadedFile("one.png", buffer.getvalue())})
    assert response.status_code == 302
    ad = RewardedAd.objects.get()
    previous = ad.media.name
    response = rivr_admin_client.post(f"/admin/profiles/rewardedad/{ad.pk}/change/",
        {**data, "media": SimpleUploadedFile("two.png", buffer.getvalue())})
    assert response.status_code == 302
    ad.refresh_from_db()
    assert ad.media.name != previous
    assert (tmp_path / ad.media.name).read_bytes() == buffer.getvalue()


@pytest.mark.django_db(transaction=True)
def test_simultaneous_claims_pay_once(registered_client, registered_user, catalog):
    started = begin(registered_client, catalog[0])
    barrier = Barrier(2)

    def claim():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=registered_user)
            barrier.wait(timeout=10)
            return client.post(BASE + started, {}, format="json").status_code
        finally:
            close_old_connections()

    with patch("profiles.ad_rewards.timezone.now", return_value=NOW + timedelta(seconds=5)):
        with ThreadPoolExecutor(max_workers=2) as pool:
            workers = [pool.submit(claim) for _ in range(2)]
            assert [worker.result(timeout=20) for worker in workers] == [200, 200]
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == 75
