from django.urls import path
from .moderation import AuditView, ContextView, TableActionView, TablesView, UserActionView, UsersView

urlpatterns = [
    path("", ContextView.as_view()),
    path("users/", UsersView.as_view()),
    path("users/<int:pk>/action/", UserActionView.as_view()),
    path("tables/", TablesView.as_view()),
    path("tables/<int:pk>/action/", TableActionView.as_view()),
    path("audit/", AuditView.as_view()),
]
