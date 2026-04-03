from django.contrib import admin

from .models import JournalEntry, JournalInsights


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "mood_at_entry", "created_at")


@admin.register(JournalInsights)
class JournalInsightsAdmin(admin.ModelAdmin):
    list_display = ("user", "period_type", "period_start", "period_end")
