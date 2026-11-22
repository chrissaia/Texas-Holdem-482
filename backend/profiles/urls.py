"""Url patterns mapped to application views for avatar storage and virtual-chip rewards."""

from django.urls import path
from . import ad_management, ad_rewards, views
from .statistics import statistics

app_name = "profiles"
urlpatterns = [
    path("ads/", ad_rewards.ads),
    path("ads/manage/", ad_management.manage_ads),
    path("ads/manage/policy/", ad_management.update_policy),
    path("ads/manage/<int:pk>/", ad_management.edit_ad),
    path("ads/<int:pk>/start/", ad_rewards.start),
    path("ads/claim/<uuid:token>/", ad_rewards.claim),
    path("stats/", statistics, name="statistics"),
    path("", views.profile, name="profile"),
    path("avatar/", views.avatar, name="avatar"),
    path("theme/", views.theme_choice, name="theme"),
    path("daily-chips/", views.daily, name="daily"),
]
