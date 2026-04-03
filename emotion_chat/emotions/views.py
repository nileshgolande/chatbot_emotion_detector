from django.db.models import Count
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmotionAnalysis


class EmotionSummaryView(APIView):
    """Aggregate emotion counts for the authenticated user (minimal dashboard hook)."""

    def get(self, request):
        qs = EmotionAnalysis.objects.filter(user=request.user)
        total = qs.count()
        rows = qs.values("primary_emotion").annotate(c=Count("id")).order_by()
        by_emotion = {row["primary_emotion"]: row["c"] for row in rows}
        latest = qs.order_by("-created_at").first()
        latest_payload = None
        if latest:
            latest_payload = {
                "primary_emotion": latest.primary_emotion,
                "confidence": latest.confidence,
                "created_at": latest.created_at.isoformat(),
            }
        return Response(
            {
                "total_analyzed": total,
                "by_emotion": by_emotion,
                "latest": latest_payload,
            }
        )
