from uuid import uuid4

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def ad_upload_path(instance, filename):
    return f"rewarded-ads/{uuid4().hex}.{filename.rsplit('.', 1)[-1].lower()}"


class RewardedAd(models.Model):
    class Kind(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    title = models.CharField(max_length=100)
    kind = models.CharField(max_length=5, choices=Kind.choices)
    media = models.FileField(upload_to=ad_upload_path)
    reward = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(10000)])
    view_seconds = models.PositiveSmallIntegerField(validators=[MinValueValidator(3), MaxValueValidator(300)])
    active = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class AdView(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ad = models.ForeignKey(RewardedAd, on_delete=models.PROTECT)
    day = models.DateField()
    token = models.UUIDField(default=uuid4, unique=True, editable=False)
    ad_revision = models.DateTimeField()
    started_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True)
    awarded_chips = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "day", "ad"], name="one_rewarded_ad_view_per_day")]


class AdRewardPolicy(models.Model):
    """One site-wide setting for the number of rewarded ads per UTC day."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    daily_limit = models.PositiveSmallIntegerField(
        default=3, validators=[MinValueValidator(1), MaxValueValidator(30)]
    )

    class Meta:
        verbose_name_plural = "Ad reward policy"
        constraints = [models.CheckConstraint(
            condition=models.Q(id=1, daily_limit__range=(1, 30)), name="single_valid_ad_reward_policy"
        )]

    def __str__(self):
        return "Daily ad reward limit"
