from django.urls import path

from . import views

app_name = "accounts"
urlpatterns = [
    path("session/", views.session, name="session"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("guest/", views.guest, name="guest"),
]
