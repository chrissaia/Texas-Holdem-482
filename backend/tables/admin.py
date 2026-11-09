"""Django administration registration and staff actions for public poker-table configuration and browsing."""

from django.contrib import admin, messages
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.template.response import TemplateResponse

from .cleanup import can_cleanup, cleanup_minutes, cleanup_tables
from .models import PokerTable, TableSeat


@admin.register(PokerTable)
class PokerTableAdmin(admin.ModelAdmin):
    """Expose table records and the confirmed, permission-checked cleanup action."""
    list_display = (
        "name", "host", "max_players", "player_count", "status", "last_activity_at",
    )
    list_filter = ("status", "is_public")
    search_fields = ("name", "host__username")
    readonly_fields = ("player_count", "created_at", "last_activity_at")
    actions = ["cleanup_old_empty_tables"]

    def get_readonly_fields(self, request, obj=None):
        """Keep a funded public seat reachable until its player leaves."""
        fields = super().get_readonly_fields(request, obj)
        return (*fields, "is_public") if obj and obj.seats.exists() else fields

    @admin.action(
        description="Clean up selected old empty public tables",
        permissions=["delete"],
    )
    def cleanup_old_empty_tables(self, request, queryset):
        """Cleanup old empty tables."""
        if not can_cleanup(request.user):
            raise PermissionDenied
        try:
            minutes = cleanup_minutes()
            if request.POST.get("confirm_cleanup") == "yes":
                result = cleanup_tables(
                    actor=request.user,
                    table_ids=queryset.values_list("pk", flat=True),
                )
                self.message_user(
                    request,
                    f"Deleted {len(result.deleted_ids)} old empty public table(s). "
                    f"Skipped {result.skipped_count} selected table(s).",
                    messages.SUCCESS,
                )
                return None
        except ImproperlyConfigured as error:
            self.message_user(request, str(error), messages.ERROR)
            return None
        return TemplateResponse(
            request,
            "admin/tables/pokertable/cleanup_confirmation.html",
            {
                **self.admin_site.each_context(request),
                "title": "Confirm cleanup of selected tables",
                "opts": self.model._meta,
                "objects": queryset,
                "minutes": minutes,
            },
        )



@admin.register(TableSeat)
class TableSeatAdmin(admin.ModelAdmin):
    """Inspect reserved chips without allowing edits that bypass accounting."""
    list_display = ("user", "table", "buy_in", "stack", "joined_at")
    readonly_fields = ("user", "table", "buy_in", "stack", "joined_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
