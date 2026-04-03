from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("entries", views.JournalEntryViewSet, basename="journal-entry")
router.register("insights", views.JournalInsightsViewSet, basename="journal-insights")

urlpatterns = [
    path("", include(router.urls)),
]
