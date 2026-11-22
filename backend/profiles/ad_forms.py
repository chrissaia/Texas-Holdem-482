from pathlib import PurePath

from django import forms
from PIL import Image, UnidentifiedImageError

from .models import RewardedAd


class RewardedAdForm(forms.ModelForm):
    class Meta:
        model = RewardedAd
        fields = "__all__"

    def clean(self):
        data = super().clean()
        upload = self.files.get(self.add_prefix("media"))
        kind = data.get("kind")
        if not upload:
            if self.instance.pk and kind and kind != self.instance.kind:
                self.add_error("media", "Upload replacement media when changing the format.")
            return data
        if not kind:
            return data
        extension = PurePath(upload.name).suffix.lower()
        valid = False
        try:
            if kind == RewardedAd.Kind.IMAGE and upload.size <= 5 * 1024**2:
                formats = {".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG", ".webp": "WEBP"}
                with Image.open(upload) as image:
                    valid = (formats.get(extension) == image.format and max(image.size) <= 4096
                             and not getattr(image, "is_animated", False))
                    if valid:
                        image.verify()
            elif kind == RewardedAd.Kind.VIDEO and upload.size <= 25 * 1024**2:
                header = upload.read(16)
                valid = (extension == ".mp4" and header[4:8] == b"ftyp") or (
                    extension == ".webm" and header.startswith(bytes.fromhex("1a45dfa3"))
                )
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError, SyntaxError):
            valid = False
        finally:
            upload.seek(0)

        if not valid:
            self.add_error("media", "Use a PNG, JPEG or WebP image up to 5 MB and 4096 px, or an MP4/WebM video up to 25 MB.")
        return data
