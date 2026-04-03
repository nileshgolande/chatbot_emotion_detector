from django.conf import settings
from django.db import models


class JournalEntry(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="journal_entries",
    )
    title = models.CharField(max_length=255)
    content = models.TextField()
    mood_at_entry = models.CharField(max_length=20)
    ai_insights = models.TextField(blank=True, null=True)
    tags = models.JSONField(blank=True, default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class JournalInsights(models.Model):
    PERIOD = (("weekly", "Weekly"), ("monthly", "Monthly"))

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="journal_insights",
    )
    period_type = models.CharField(max_length=20, choices=PERIOD)
    period_start = models.DateField()
    period_end = models.DateField()
    top_emotions = models.JSONField()
    patterns = models.TextField()
    recommendations = models.TextField()
    sentiment_trend = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-period_start"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "period_type", "period_start"],
                name="uniq_journal_insights_user_period_start",
            )
        ]

    def __str__(self):
        return f"Insights {self.user_id} {self.period_type}"
