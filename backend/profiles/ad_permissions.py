"""Permissions shared by the staff ad editor and its navigation."""
from rest_framework.permissions import BasePermission

from tables.permissions import can_host

MANAGEMENT_PERMISSIONS = (
    "profiles.add_rewardedad", "profiles.change_rewardedad",
    "profiles.add_adrewardpolicy", "profiles.change_adrewardpolicy",
)


def can_manage_ads(request):
    return bool(can_host(request) and request.user.is_staff and request.user.has_perms(MANAGEMENT_PERMISSIONS))


class CanManageAds(BasePermission):
    message = "You need ad management permissions to use this page."

    def has_permission(self, request, view):
        return can_manage_ads(request)
