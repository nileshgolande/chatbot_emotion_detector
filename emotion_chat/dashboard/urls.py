from django.urls import path

from .views import DashboardViewSet

urlpatterns = [
    path(
        "emotion_stats/",
        DashboardViewSet.as_view({"get": "emotion_stats"}),
    ),
    path(
        "mood_trend/",
        DashboardViewSet.as_view({"get": "mood_trend"}),
    ),
    path(
        "weekly_report/",
        DashboardViewSet.as_view({"get": "weekly_report"}),
    ),
    path(
        "monthly_report/",
        DashboardViewSet.as_view({"get": "monthly_report"}),
    ),
]
