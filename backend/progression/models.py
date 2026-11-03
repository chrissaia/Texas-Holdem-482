from django.conf import settings
from django.db import models


class Progress(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    hands_played = models.PositiveBigIntegerField(default=0)
    win_streak = models.PositiveBigIntegerField(default=0)
    theme = models.CharField(max_length=5, choices=[("dark", "Dark navy"), ("light", "Light")], default="dark")


class Achievement(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    code = models.CharField(max_length=30)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "code"], name="unique_user_achievement")]


class Event(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=20)
    source = models.CharField(max_length=100)
    outcome = models.CharField(max_length=10, blank=True)
    xp = models.PositiveIntegerField(default=0)
    facts = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "kind", "source"], name="unique_progression_event")]
