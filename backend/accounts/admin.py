"""Django administration registration and staff actions for account identity, authentication and guest sessions."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

admin.site.register(User, UserAdmin)
