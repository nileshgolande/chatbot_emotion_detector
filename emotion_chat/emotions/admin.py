from django.contrib import admin

from .models import DailyMoodSummary, EmotionAnalysis


@admin.register(EmotionAnalysis)
class EmotionAnalysisAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "primary_emotion", "confidence", "created_at")


@admin.register(DailyMoodSummary)
class DailyMoodSummaryAdmin(admin.ModelAdmin):
    list_display = ("user", "date", "dominant_emotion", "messages_count")
