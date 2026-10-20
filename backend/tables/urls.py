from django.urls import path

from .views import TableCreateView, TableDetailView, creation_context

app_name = "tables"
urlpatterns = [
    path("", TableCreateView.as_view(), name="create"),
    path("creation-context/", creation_context, name="creation-context"),
    path("<int:pk>/", TableDetailView.as_view(), name="detail"),
]
