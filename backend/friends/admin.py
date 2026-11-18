"""Django administration registration and staff actions for friend requests, relationships and player discovery."""

from django.contrib import admin

from .models import Friendship, Presence


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    """Expose friendship relationships and request status to authorized administrators."""
    list_display = ("from_user", "to_user", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("from_user__username", "to_user__username")
    readonly_fields = ("created_at",)


@admin.register(Presence)
class PresenceAdmin(admin.ModelAdmin):
    """Read-only view of when registered players were last active (S20)."""
    list_display = ("user", "last_seen_at")
    search_fields = ("user__username",)
    readonly_fields = ("user", "last_seen_at")
