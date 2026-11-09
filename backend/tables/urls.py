"""Url patterns mapped to application views for public poker-table configuration and browsing."""

from django.urls import path

from .views import TableListCreateView, TableDetailView, creation_context

from .seating_views import seat

app_name = "tables"
urlpatterns = [
    path("<int:pk>/seat/", seat, name="seat"),
    path("", TableListCreateView.as_view(), name="create"),
    path("creation-context/", creation_context, name="creation-context"),
    path("<int:pk>/", TableDetailView.as_view(), name="detail"),
]
