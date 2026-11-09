"""Read-only staff inspection of S16 chip-result receipts."""
from django.contrib import admin

from .models import ChipResult


@admin.register(ChipResult)
class ChipResultAdmin(admin.ModelAdmin):
    """Receipts describe committed results; the admin UI cannot mint or rewrite them."""

    list_display = ("user", "source", "delta", "balance_after", "created_at")
    search_fields = ("user__username", "source")
    readonly_fields = ("user", "source", "delta", "balance_after", "created_at")

    def has_add_permission(self, request):
        """Only trusted game code may create a result."""
        return False

    def has_change_permission(self, request, obj=None):
        """Never permit editing an already saved receipt."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Preserve receipts so a retry cannot become a second payout."""
        return False
