from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from emotions.models import DailyMoodSummary, EmotionAnalysis

# Valence for trend line: negative = heavier moods, positive = lighter (matches dashboard colors / UX).
MOOD_SCORE_BY_EMOTION = {
    "happy": 2.0,
    "neutral": 0.0,
    "anxious": -0.7,
    "sad": -1.5,
    "angry": -1.2,
}


class DashboardViewSet(ViewSet):
    """Analytics: emotion_stats, mood_trend, weekly_report, monthly_report."""

    permission_classes = [IsAuthenticated]

    def emotion_stats(self, request):
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

    def mood_trend(self, request):
        try:
            days = int(request.query_params.get("days", 30))
        except (TypeError, ValueError):
            days = 30
        days = max(1, min(days, 366))
        end = timezone.localdate()
        start = end - timedelta(days=days - 1)
        rows = DailyMoodSummary.objects.filter(
            user=request.user, date__gte=start, date__lte=end
        ).order_by("date")
        series = [
            {
                "date": r.date.isoformat(),
                "dominant_emotion": r.dominant_emotion,
                "messages_count": r.messages_count,
                "avg_confidence": r.avg_confidence,
                "emotion_distribution": r.emotion_distribution,
            }
            for r in rows
        ]
        return Response(
            {
                "days": days,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "points": series,
                "series": series,
            }
        )

    def mood_timeline(self, request):
        """
        Per-message mood trend from all chat-derived emotion analyses (chronological).
        Returns up to `limit` most recent points (default 2000, max 5000) so the chart stays responsive.
        """
        try:
            limit = int(request.query_params.get("limit", 2000))
        except (TypeError, ValueError):
            limit = 2000
        limit = max(1, min(limit, 5000))

        base = EmotionAnalysis.objects.filter(user=request.user)
        total_in_db = base.count()
        # Newest first, then reverse so chart reads left → right in time.
        rows = list(base.order_by("-created_at")[:limit])
        rows.reverse()

        points = [
            {
                "i": idx + 1,
                "at": row.created_at.isoformat(),
                "emotion": row.primary_emotion,
                "mood_score": float(MOOD_SCORE_BY_EMOTION.get(row.primary_emotion, 0.0)),
                "confidence": float(row.confidence),
            }
            for idx, row in enumerate(rows)
        ]
        return Response(
            {
                "total_in_db": total_in_db,
                "returned": len(points),
                "limit": limit,
                "truncated": total_in_db > limit,
                "mood_scale": MOOD_SCORE_BY_EMOTION,
                "points": points,
            }
        )

    def weekly_report(self, request):
        end = timezone.localdate()
        start = end - timedelta(days=6)
        return Response(self._period_report(request.user, start, end, "week"))

    def monthly_report(self, request):
        end = timezone.localdate()
        start = end.replace(day=1)
        return Response(self._period_report(request.user, start, end, "month"))

    def _period_report(self, user, start, end, label):
        ea = EmotionAnalysis.objects.filter(
            user=user, created_at__date__gte=start, created_at__date__lte=end
        )
        total = ea.count()
        by_emotion = {
            row["primary_emotion"]: row["c"]
            for row in ea.values("primary_emotion").annotate(c=Count("id"))
        }
        moods = DailyMoodSummary.objects.filter(user=user, date__gte=start, date__lte=end)
        mood_days = moods.count()
        return {
            "period": label,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "emotion_analyses_count": total,
            "by_emotion": by_emotion,
            "daily_mood_days_recorded": mood_days,
            "daily_mood_summaries": [
                {
                    "date": m.date.isoformat(),
                    "dominant_emotion": m.dominant_emotion,
                    "messages_count": m.messages_count,
                }
                for m in moods.order_by("date")
            ],
        }
