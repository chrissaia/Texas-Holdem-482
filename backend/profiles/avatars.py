"""Normalize validated avatars before storing any user-supplied bytes."""
from io import BytesIO
import logging
import warnings
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_SIDE = 4096
AVATAR_SIZE = 256
FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
logger = logging.getLogger(__name__)


def normalize_avatar(upload):
    if upload.size > MAX_UPLOAD_BYTES:
        raise ValidationError({"avatar": ["Choose an image no larger than 2 MB."]})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(upload) as image:
                if image.format not in FORMATS or upload.content_type != FORMATS[image.format]:
                    raise ValidationError({"avatar": ["Use a JPEG, PNG, or WebP image with a matching content type."]})
                if max(image.size) > MAX_SIDE or min(image.size) < 1 or getattr(image, "is_animated", False):
                    raise ValidationError({"avatar": ["Use a still image no larger than 4096 × 4096 pixels."]})
                image.verify()
            upload.seek(0)
            with Image.open(upload) as image:
                image.load()
                normalized = ImageOps.fit(ImageOps.exif_transpose(image).convert("RGB"), (AVATAR_SIZE, AVATAR_SIZE), method=Image.Resampling.LANCZOS)
                output = BytesIO()
                normalized.save(output, format="WEBP", quality=85)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ValidationError({"avatar": ["This file could not be read as a valid image."]}) from exc
    return ContentFile(output.getvalue(), name=f"{uuid4().hex}.webp")


def delete_old_avatar(storage, name):
    try:
        storage.delete(name)
    except OSError:
        # The new avatar is already committed; a cleanup failure must not undo success.
        logger.exception("Could not remove replaced avatar")


def replace_avatar(user_id, content):
    saved_name = None
    storage = get_user_model()._meta.get_field("avatar").storage
    try:
        with transaction.atomic():
            user = get_user_model().objects.select_for_update().get(pk=user_id)
            old_name = user.avatar.name
            user.avatar.save(content.name, content, save=False)
            saved_name = user.avatar.name
            user.save(update_fields=["avatar"])
            if old_name:
                transaction.on_commit(lambda: delete_old_avatar(storage, old_name))
        return user
    except Exception:
        if saved_name:
            delete_old_avatar(storage, saved_name)
        raise
