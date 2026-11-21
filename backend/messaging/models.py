"""S21: direct messages between friends and chat at a poker table."""

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

MAX_LENGTH = 500


class DirectMessage(models.Model):
    """A private message between two accepted friends. read_at is set when the recipient opens it."""

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_messages")
    body = models.TextField(max_length=MAX_LENGTH)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=~Q(sender=F("recipient")), name="messaging_no_self_message"),
        ]
        indexes = [
            models.Index(fields=["sender", "recipient", "id"], name="messaging_dm_pair"),
            models.Index(fields=["recipient", "read_at"], name="messaging_dm_unread"),
        ]

    def __str__(self):
        return f"{self.sender} → {self.recipient} at {self.created_at:%Y-%m-%d %H:%M}"


class TableMessage(models.Model):
    """A chat line at a table. Seated players post; anyone who may see the table can read."""

    table = models.ForeignKey("tables.PokerTable", on_delete=models.CASCADE, related_name="chat_messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="table_messages")
    body = models.TextField(max_length=MAX_LENGTH)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["table", "id"], name="messaging_table_chat")]

    def __str__(self):
        return f"{self.sender} at table {self.table_id} at {self.created_at:%Y-%m-%d %H:%M}"
