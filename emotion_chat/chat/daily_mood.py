"""Aggregate daily mood from today's EmotionAnalysis rows."""
from __future__ import annotations

from typing import Any

from django.db.models import Avg, Count
from django.utils import timezone

from emotions.models import DailyMoodSummary, EmotionAnalysis


def update_daily_mood(user, analysis: dict[str, Any] | None = None) -> None:
    """
    Recompute DailyMoodSummary for today from all EmotionAnalysis rows
    for this user with created_at on the current calendar day (local TZ).
    Optional ``analysis`` is accepted for API compatibility; aggregation uses DB state.
    """
    _ = analysis
    today = timezone.localdate()
    qs = EmotionAnalysis.objects.filter(user=user, created_at__date=today)
    n = qs.count()
    if n == 0:
        DailyMoodSummary.objects.filter(user=user, date=today).delete()
        return

    agg = qs.values("primary_emotion").annotate(c=Count("id"))
    dist = {row["primary_emotion"]: row["c"] for row in agg}
    dominant = max(dist, key=lambda k: dist[k])
    avg_conf = qs.aggregate(a=Avg("confidence"))["a"] or 0.5

    DailyMoodSummary.objects.update_or_create(
        user=user,
        date=today,
        defaults={
            "dominant_emotion": dominant,
            "emotion_distribution": dist,
            "avg_confidence": float(avg_conf),
            "messages_count": n,
        },
    )
