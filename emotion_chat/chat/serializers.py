from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers

from emotions.emotion_emojis import EMOTION_EMOJIS

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    emotion = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ("id", "sender", "content", "emotion", "created_at")

    def get_emotion(self, obj):
        if obj.sender != "user":
            return None
        try:
            ea = obj.emotion
        except ObjectDoesNotExist:
            return None
        return {
            "primary_emotion": ea.primary_emotion,
            "emoji": EMOTION_EMOJIS.get(ea.primary_emotion, "✨"),
            "confidence": ea.confidence,
            "emotion_scores": ea.emotion_scores,
        }


class ConversationSerializer(serializers.ModelSerializer):
    last_message_preview = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ("id", "title", "last_message_preview", "created_at", "updated_at")

    def get_last_message_preview(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if not last:
            return ""
        t = last.content
        return t[:120] + ("…" if len(t) > 120 else "")


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = (
            "id",
            "title",
            "agent_relationship_stage",
            "created_at",
            "updated_at",
            "messages",
        )


class ConversationCreateSerializer(serializers.ModelSerializer):
    """Optional `first_message` creates the conversation and first reply in one request."""

    first_message = serializers.CharField(
        required=False,
        allow_blank=True,
        write_only=True,
        max_length=6000,
    )

    class Meta:
        model = Conversation
        fields = ("title", "first_message")

    def create(self, validated_data):
        validated_data.pop("first_message", None)
        return super().create(validated_data)
