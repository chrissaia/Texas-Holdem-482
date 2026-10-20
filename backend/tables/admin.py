from django.contrib import admin

from .models import PokerTable


@admin.register(PokerTable)
class PokerTableAdmin(admin.ModelAdmin):
    list_display = ("name", "host", "max_players", "player_count", "status", "created_at")
    list_filter = ("status", "is_public")
    search_fields = ("name", "host__username")
    readonly_fields = ("player_count", "created_at", "last_activity_at")
