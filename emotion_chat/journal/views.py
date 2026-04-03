from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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
