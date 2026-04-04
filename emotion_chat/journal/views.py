from datetime import date

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .daily_digest import build_daily_digest
from .journal_ai_insights import journal_ai
from .models import JournalEntry, JournalInsights
from .serializers import JournalEntrySerializer, JournalInsightsSerializer


class JournalEntryViewSet(viewsets.ModelViewSet):
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JournalEntry.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        d = timezone.localdate()
        qs = self.get_queryset().filter(created_at__date=d).order_by("-created_at")
        return Response(JournalEntrySerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="daily_digest")
    def daily_digest(self, request):
        """Aggregates chat emotion history for a day + heuristic / LLM narrative."""
        raw = (request.query_params.get("date") or "").strip()
        try:
            target = date.fromisoformat(raw) if raw else timezone.localdate()
        except ValueError:
            return Response(
                {"detail": "Invalid date. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payload = build_daily_digest(request.user, target)
        payload = journal_ai.enrich_daily_digest(payload)
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="quick_reflect")
    def quick_reflect(self, request):
        """Empathic reply to ad-hoc journal text (saved entry optional)."""
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response(
                {"detail": "text required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tlow = text.lower()
        mood = "neutral"
        for label, words in (
            ("anxious", ("anxious", "worry", "nervous", "panic", "stress")),
            ("sad", ("sad", "cry", "lonely", "hurt", "depressed")),
            ("angry", ("angry", "frustrat", "furious", "hate", "annoyed")),
            ("happy", ("happy", "grateful", "love", "great", "excited")),
        ):
            if any(w in tlow for w in words):
                mood = label
                break
        reply = journal_ai.generate_entry_insights("Journal reflection", text[:6000], mood)
        return Response({"mood_guess": mood, "reply": reply})

    @action(detail=True, methods=["post"], url_path="generate_insights")
    def generate_insights(self, request, pk=None):
        entry = self.get_object()
        text = journal_ai.generate_entry_insights(
            entry.title, entry.content, entry.mood_at_entry
        )
        entry.ai_insights = text
        entry.save(update_fields=["ai_insights", "updated_at"])
        return Response(JournalEntrySerializer(entry).data, status=status.HTTP_200_OK)


class JournalInsightsViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = JournalInsightsSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return JournalInsights.objects.filter(user=self.request.user)
