from django.contrib import admin

from .ad_forms import RewardedAdForm
from .models import AdRewardPolicy, RewardedAd


@admin.register(RewardedAd)
class RewardedAdAdmin(admin.ModelAdmin):
    form = RewardedAdForm
    list_display = ("title", "kind", "reward", "view_seconds", "active")
    list_filter = ("active", "kind")
    search_fields = ("title",)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(AdRewardPolicy)
class AdRewardPolicyAdmin(admin.ModelAdmin):
    list_display = ("__str__", "daily_limit")

    def has_add_permission(self, request):
        return super().has_add_permission(request) and not AdRewardPolicy.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
