from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("conversations", views.ConversationViewSet, basename="conversation")

urlpatterns = [
    path("llm/", views.llm_response_view, name="llm-response"),
    path("", include(router.urls)),
]
