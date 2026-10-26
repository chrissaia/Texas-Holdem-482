from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from profiles.avatars import MAX_UPLOAD_BYTES, normalize_avatar, replace_avatar

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def isolated_media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def image_file(fmt='PNG', size=(40, 60), content_type=None):
    output = BytesIO()
    Image.new('RGB', size, 'purple').save(output, format=fmt)
    return SimpleUploadedFile('untrusted-name.'+fmt.lower(), output.getvalue(),
                              content_type=content_type or {'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}[fmt])


@pytest.mark.parametrize('fmt', ['JPEG', 'PNG', 'WEBP'])
def test_upload_persists_normalized_image_and_ownership(fmt, registered_client, registered_user, settings):
    other = get_user_model().objects.create_user(username='untouched')
    response = registered_client.post(reverse('profiles:avatar'), {'avatar': image_file(fmt)}, format='multipart')
    assert response.status_code == 200
    registered_user.refresh_from_db(); other.refresh_from_db()
    assert not other.avatar and registered_user.avatar
    assert registered_user.avatar.name.startswith('avatars/')
    assert 'untrusted-name' not in registered_user.avatar.name
    assert response.data['avatar_url'] == '/media/' + registered_user.avatar.name
    with Image.open(registered_user.avatar.path) as img:
        assert img.size == (256, 256) and img.format == 'WEBP' and not img.getexif()
    assert Path(registered_user.avatar.path).is_file()
    assert response.data['chip_balance'] == 0


@pytest.mark.parametrize('kind', ['fake','mismatch','huge','dimensions','animated','truncated','svg'])
def test_bad_images_never_change_profile(kind, registered_client, registered_user):
    upload = image_file()
    if kind == 'fake': upload = SimpleUploadedFile('fake.png', b'not an image', content_type='image/png')
    if kind == 'mismatch': upload = image_file('PNG', content_type='image/jpeg')
    if kind == 'huge': upload = SimpleUploadedFile('large.png', b'x'*(MAX_UPLOAD_BYTES+1), content_type='image/png')
    if kind == 'dimensions': upload = image_file(size=(4097, 2))
    if kind == 'truncated': upload = SimpleUploadedFile('broken.png', upload.read()[:40], content_type='image/png')
    if kind == 'svg': upload = SimpleUploadedFile('image.svg', b'<svg onload="alert(1)"/>', content_type='image/svg+xml')
    if kind == 'animated':
        data = BytesIO()
        Image.new('RGB',(10,10),'red').save(data, format='WEBP', save_all=True, append_images=[Image.new('RGB',(10,10),'blue')], duration=100)
        upload = SimpleUploadedFile('animated.webp',data.getvalue(),content_type='image/webp')
    response = registered_client.post(reverse('profiles:avatar'), {'avatar':upload}, format='multipart')
    assert response.status_code == 400 and 'avatar' in response.data
    registered_user.refresh_from_db()
    assert not registered_user.avatar


def test_replacement_deletes_previous_file_after_commit(registered_client, registered_user, django_capture_on_commit_callbacks):
    assert registered_client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart').status_code == 200
    registered_user.refresh_from_db(); old = Path(registered_user.avatar.path)
    with django_capture_on_commit_callbacks(execute=True):
        assert registered_client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart').status_code == 200
        assert old.exists()
    registered_user.refresh_from_db()
    assert not old.exists() and Path(registered_user.avatar.path).exists()


def test_database_failure_removes_new_file_and_keeps_old(registered_client, registered_user, settings):
    registered_client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart')
    registered_user.refresh_from_db(); old_name = registered_user.avatar.name
    with patch('accounts.models.User.save', side_effect=RuntimeError('DB write failed')):
        with pytest.raises(RuntimeError): replace_avatar(registered_user.pk, normalize_avatar(image_file()))
    registered_user.refresh_from_db()
    assert registered_user.avatar.name == old_name
    assert len(list(Path(settings.MEDIA_ROOT).rglob('*.webp'))) == 1


def test_unknown_fields_multiple_files_and_csrf(registered_client, registered_user):
    for body in [{}, {'avatar':image_file(),'user_id': 999}, {'avatar':[image_file(),image_file()]}]:
        assert registered_client.post(reverse('profiles:avatar'), body, format='multipart').status_code == 400
    from rest_framework.test import APIClient
    client = APIClient(enforce_csrf_checks=True);client.force_login(registered_user)
    assert client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart').status_code == 403


def test_uploaded_metadata_is_removed(registered_client, registered_user):
    output = BytesIO()
    image = Image.new('RGB', (40, 60), 'purple')
    metadata = Image.Exif()
    metadata[270] = 'private camera metadata'
    metadata[274] = 6
    image.save(output, format='JPEG', exif=metadata)
    upload = SimpleUploadedFile('camera.jpg', output.getvalue(), content_type='image/jpeg')
    assert registered_client.post(reverse('profiles:avatar'), {'avatar':upload}, format='multipart').status_code == 200
    registered_user.refresh_from_db()
    with Image.open(registered_user.avatar.path) as stored:
        assert not stored.getexif() and stored.size == (256,256)


def test_decompression_bomb_is_rejected(registered_client, monkeypatch):
    upload = image_file()
    monkeypatch.setattr(Image, 'MAX_IMAGE_PIXELS', 10)
    response = registered_client.post(reverse('profiles:avatar'), {'avatar':upload}, format='multipart')
    assert response.status_code == 400


def test_replaced_file_cleanup_failure_does_not_undo_success(registered_client, registered_user, django_capture_on_commit_callbacks):
    registered_client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart')
    storage = get_user_model()._meta.get_field('avatar').storage
    with patch.object(storage, 'delete', side_effect=OSError('storage unavailable')):
        with django_capture_on_commit_callbacks(execute=True):
            response = registered_client.post(reverse('profiles:avatar'), {'avatar':image_file()}, format='multipart')
    assert response.status_code == 200
    registered_user.refresh_from_db()
    assert Path(registered_user.avatar.path).exists()
