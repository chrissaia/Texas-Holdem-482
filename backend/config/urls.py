from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

from core.views import health

urlpatterns = [
    path("api/profile/", include("profiles.urls")),
    path("api/auth/", include("accounts.urls")),
    path("api/tables/", include("tables.urls")),
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
