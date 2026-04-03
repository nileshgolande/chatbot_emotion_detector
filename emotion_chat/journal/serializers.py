from rest_framework import serializers

from .models import JournalEntry, JournalInsights


class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = (
            "id",
            "title",
            "content",
            "mood_at_entry",
            "ai_insights",
            "tags",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("ai_insights",)


class JournalInsightsSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalInsights
        fields = (
            "id",
            "period_type",
            "period_start",
            "period_end",
            "top_emotions",
            "patterns",
            "recommendations",
            "sentiment_trend",
            "created_at",
        )
        read_only_fields = fields
