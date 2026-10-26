from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, IntegrityError, transaction
from django.urls import reverse

from accounts.services import register_user
from conftest import csrf_client
from profiles.rewards import (
    AlreadyClaimed, BalanceLimit, MAX_BALANCE,
    claim_daily_chips, grant_starting_chips, reward_status,
)

pytestmark = pytest.mark.django_db


def test_registration_grants_exactly_1000_once():
    client = csrf_client()
    response = client.post(reverse('accounts:register'), {
        'username': 'new-player', 'email': 'new@example.com', 'password': 'flop-turn-river-9',
    }, format='json')
    assert response.status_code == 201
    user = get_user_model().objects.get(username='new-player')
    assert user.chip_balance == 1000 and user.starting_chips_granted_at is not None
    marker = user.starting_chips_granted_at
    for _ in range(3):
        grant_starting_chips(user.pk)
    user.refresh_from_db()
    assert user.chip_balance == 1000 and user.starting_chips_granted_at == marker
    assert client.get(reverse('profiles:profile')).data['chip_balance'] == 1000


def test_failed_grant_rolls_back_registration(monkeypatch):
    def fail(user_id):
        grant_starting_chips(user_id)
        raise RuntimeError('grant failure')
    monkeypatch.setattr('accounts.services.grant_starting_chips', fail)
    with pytest.raises(RuntimeError):
        register_user(username='rolled-back', email='rollback@example.com', password='flop-turn-river-9')
    assert not get_user_model().objects.filter(username='rolled-back').exists()


def test_daily_claim_persists_and_cannot_be_repeated(registered_client, registered_user):
    response = registered_client.post(reverse('profiles:daily'), {}, format='json')
    assert response.status_code == 200 and response.data['chip_balance'] == 500
    assert not response.data['daily_reward']['available']
    registered_user.refresh_from_db()
    marker = registered_user.daily_chips_claimed_at
    assert marker is not None
    assert registered_client.post(reverse('profiles:daily'), {}, format='json').status_code == 409
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == 500 and registered_user.daily_chips_claimed_at == marker


def test_utc_midnight_and_backward_clock(registered_user, monkeypatch):
    now = datetime(2026, 10, 25, 23, 59, 59, tzinfo=timezone.utc)
    monkeypatch.setattr('profiles.rewards.timezone.now', lambda: now)
    user = claim_daily_chips(registered_user.pk)
    assert reward_status(user)['next_claim_at'] == datetime(2026, 10, 26, tzinfo=timezone.utc)
    now = datetime(2026, 10, 26, tzinfo=timezone.utc)
    user = claim_daily_chips(user.pk)
    assert user.chip_balance == 1000
    with pytest.raises(AlreadyClaimed):
        claim_daily_chips(user.pk)
    now -= timedelta(days=1)
    assert not reward_status(user)['available']
    # Local calendar date must not control eligibility.
    now = datetime(2026, 10, 27, 1, tzinfo=timezone(timedelta(hours=3)))
    assert not reward_status(user)['available']


@pytest.mark.parametrize('service,amount', [(claim_daily_chips, 500), (grant_starting_chips, 1000)])
def test_balance_limit_is_atomic(registered_user, service, amount):
    registered_user.chip_balance = MAX_BALANCE - amount + 1
    registered_user.save(update_fields=['chip_balance'])
    with pytest.raises(BalanceLimit):
        service(registered_user.pk)
    registered_user.refresh_from_db()
    assert registered_user.chip_balance == MAX_BALANCE - amount + 1
    assert registered_user.daily_chips_claimed_at is None
    assert registered_user.starting_chips_granted_at is None


def test_daily_limit_response_and_untrusted_body(registered_user, registered_client):
    registered_user.chip_balance = MAX_BALANCE
    registered_user.save(update_fields=['chip_balance'])
    assert registered_client.post(reverse('profiles:daily'), {}, format='json').status_code == 409
    for payload in [{'amount': 9999}, {'user_id': 8}, {'claim_time': 'tomorrow'}, []]:
        assert registered_client.post(reverse('profiles:daily'), payload, format='json').status_code == 400


def test_profile_private_permissions_and_csrf(registered_user, guest_client):
    from rest_framework.test import APIClient
    for client in [APIClient(), guest_client]:
        assert client.get(reverse('profiles:profile')).status_code == 403
        assert client.post(reverse('profiles:daily'), {}, format='json').status_code == 403
        assert client.post(reverse('profiles:avatar'), {}, format='multipart').status_code == 403
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(registered_user)
    assert client.post(reverse('profiles:daily'), {}, format='json').status_code == 403
    response = client.get(reverse('profiles:profile'))
    assert response.status_code == 200 and response.data['avatar_url'] is None
    assert 'no-store' in response['Cache-Control']
    assert 'email' not in response.data and 'password' not in response.data


@pytest.mark.parametrize('balance', [-1, MAX_BALANCE + 1])
def test_database_balance_constraints(registered_user, balance):
    with pytest.raises(IntegrityError), transaction.atomic():
        get_user_model().objects.filter(pk=registered_user.pk).update(chip_balance=balance)


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize('service,expected', [(claim_daily_chips, 500), (grant_starting_chips, 1000)])
def test_simultaneous_requests_pay_once(service, expected):
    user = get_user_model().objects.create_user(username='concurrent')
    barrier = Barrier(2)
    def worker():
        close_old_connections()
        try:
            barrier.wait(timeout=10)
            try:
                service(user.pk)
                return 'ok'
            except AlreadyClaimed:
                return 'already'
        finally:
            close_old_connections()
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(worker) for _ in range(2)]
        results = [f.result(timeout=20) for f in futures]
    user.refresh_from_db()
    assert user.chip_balance == expected
    if service is claim_daily_chips:
        assert sorted(results) == ['already', 'ok']
    else:
        assert results == ['ok', 'ok']
