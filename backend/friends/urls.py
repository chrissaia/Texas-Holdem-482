"""Url patterns mapped to application views for friend requests, relationships and player discovery."""

from django.urls import path

from . import views

app_name = "friends"
urlpatterns = [
    path("", views.friend_list, name="list"),
    path("search/", views.search_players, name="search"),
    path("<int:pk>/", views.remove_friend, name="remove"),
    path("requests/", views.send_request, name="send"),
    path("requests/<int:pk>/accept/", views.accept_request, name="accept"),
    path("requests/<int:pk>/decline/", views.decline_request, name="decline"),
    path("requests/<int:pk>/cancel/", views.cancel_request, name="cancel"),
]
