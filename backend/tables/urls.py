"""Url patterns mapped to application views for public poker-table configuration and browsing."""

from django.urls import path

from .views import TableListCreateView, TableDetailView, creation_context

from .seating_views import seat
from .private_views import private_tables, invitations
from .spectating import spectator_state
from .game_views import game_action, game_state, game_timeout

app_name = "tables"
urlpatterns = [
    path("private/", private_tables, name="private"),
    path("<int:pk>/invitations/", invitations, name="invitations"),
    path("<int:pk>/watch/", spectator_state, name="watch"),
    path("<int:pk>/game/action/", game_action, name="game-action"),
    path("<int:pk>/game/timeout/", game_timeout, name="game-timeout"),
    path("<int:pk>/game/", game_state, name="game"),
    path("<int:pk>/seat/", seat, name="seat"),
    path("", TableListCreateView.as_view(), name="create"),
    path("creation-context/", creation_context, name="creation-context"),
    path("<int:pk>/", TableDetailView.as_view(), name="detail"),
]
