from django.urls import path
from . import views

app_name = "profiles"
urlpatterns = [
    path("", views.profile, name="profile"),
    path("avatar/", views.avatar, name="avatar"),
    path("daily-chips/", views.daily, name="daily"),
]
