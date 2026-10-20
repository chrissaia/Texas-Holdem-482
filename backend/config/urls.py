from django.contrib import admin
from django.urls import include, path

from core.views import health

urlpatterns = [
    path("api/auth/", include("accounts.urls")),
    path("api/tables/", include("tables.urls")),
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]
