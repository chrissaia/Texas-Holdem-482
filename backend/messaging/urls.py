from django.urls import path

from . import views

app_name = "messaging"
urlpatterns = [
    path("", views.conversation_list, name="conversations"),
    path("<int:friend_id>/", views.conversation, name="conversation"),
    path("tables/<int:table_id>/", views.table_chat, name="table-chat"),
]
