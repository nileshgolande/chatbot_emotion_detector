from django.conf import settings
from django.db import models


class Conversation(models.Model):
    REL_STAGE = (
        ("stranger", "Stranger"),
        ("acquaintance", "Acquaintance"),
        ("trusted", "Trusted"),
        ("close", "Close"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, blank=True, null=True)
    agent_metadata = models.JSONField(blank=True, default=dict)
    agent_relationship_stage = models.CharField(
        max_length=20, choices=REL_STAGE, default="stranger"
    )
    empathy_effectiveness = models.FloatField(default=0.5)
    user_satisfaction = models.FloatField(default=0.5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title or f"Conversation {self.pk}"


class Message(models.Model):
    SENDER = (("user", "User"), ("bot", "Bot"))

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.CharField(max_length=10, choices=SENDER)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender}: {self.content[:40]}..."


class UserChatMemory(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_memory",
    )
    preferred_name = models.CharField(max_length=120, blank=True, default="")
    facts = models.JSONField(blank=True, default=list)
    recent_emotions = models.JSONField(blank=True, default=list)
    user_message_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "User chat memories"

    def __str__(self):
        return f"Memory<{self.user_id}>"
