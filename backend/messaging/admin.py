"""Read-only moderation views for S21 messages."""

from django.contrib import admin

from .models import DirectMessage, TableMessage


@admin.register(DirectMessage)
class DirectMessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "recipient", "created_at", "read_at")
    search_fields = ("sender__username", "recipient__username", "body")
    readonly_fields = ("sender", "recipient", "body", "created_at", "read_at")


@admin.register(TableMessage)
class TableMessageAdmin(admin.ModelAdmin):
    list_display = ("table", "sender", "created_at")
    search_fields = ("table__name", "sender__username", "body")
    readonly_fields = ("table", "sender", "body", "created_at")
