"""Url patterns mapped to application views for public poker-table configuration and browsing."""

from django.urls import path

from .views import TableListCreateView, TableDetailView, creation_context

from .seating_views import seat
from .private_views import private_tables, invitations
from .spectating import spectator_state

app_name = "tables"
urlpatterns = [
    path("private/", private_tables, name="private"),
    path("<int:pk>/invitations/", invitations, name="invitations"),
    path("<int:pk>/watch/", spectator_state, name="watch"),
    path("<int:pk>/seat/", seat, name="seat"),
    path("", TableListCreateView.as_view(), name="create"),
    path("creation-context/", creation_context, name="creation-context"),
    path("<int:pk>/", TableDetailView.as_view(), name="detail"),
]
