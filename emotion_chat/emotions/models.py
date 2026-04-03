from django.conf import settings
from django.db import models
from pgvector.django import VectorField


class EmotionAnalysis(models.Model):
    EMOTION_CHOICES = (
        ("happy", "Happy"),
        ("sad", "Sad"),
        ("anxious", "Anxious"),
        ("angry", "Angry"),
        ("neutral", "Neutral"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="emotions"
    )
    message = models.OneToOneField(
        "chat.Message", on_delete=models.CASCADE, related_name="emotion"
    )
    primary_emotion = models.CharField(max_length=20, choices=EMOTION_CHOICES)
    emotion_scores = models.JSONField()
    emotion_vector = VectorField(dimensions=768, null=True, blank=True)
    confidence = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.primary_emotion} ({self.confidence:.2f})"


class DailyMoodSummary(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="daily_moods",
    )
    date = models.DateField()
    dominant_emotion = models.CharField(max_length=20)
    emotion_distribution = models.JSONField()
    avg_confidence = models.FloatField()
    messages_count = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "date"], name="uniq_daily_mood_user_date"
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.date} {self.dominant_emotion}"
