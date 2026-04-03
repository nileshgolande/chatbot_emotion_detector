from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/chat/", include("chat.urls")),
    path("api/emotions/", include("emotions.urls")),
    path("api/journal/", include("journal.urls")),
    path("api/dashboard/", include("dashboard.urls")),
]
