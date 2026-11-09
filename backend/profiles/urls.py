"""Url patterns mapped to application views for avatar storage and virtual-chip rewards."""

from django.urls import path
from . import views
from .statistics import statistics

app_name = "profiles"
urlpatterns = [
    path("stats/", statistics, name="statistics"),
    path("", views.profile, name="profile"),
    path("avatar/", views.avatar, name="avatar"),
    path("theme/", views.theme_choice, name="theme"),
    path("daily-chips/", views.daily, name="daily"),
]
