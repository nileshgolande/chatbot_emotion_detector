from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from emotions.emotion_detector import emotion_detector
from emotions.models import EmotionAnalysis

from .ai_response_generator import AIResponseGenerator
from .daily_mood import update_daily_mood
from .models import Conversation, Message
from .serializers import (
    ConversationCreateSerializer,
    ConversationDetailSerializer,
    ConversationSerializer,
    MessageSerializer,
)

_ai = AIResponseGenerator()


class ConversationViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.filter(user=self.request.user)
        if self.action == "retrieve":
            qs = qs.prefetch_related("messages")
        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return ConversationCreateSerializer
        if self.action == "retrieve":
            return ConversationDetailSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get"])
    def messages(self, request, pk=None):
        conv = self.get_object()
        msgs = conv.messages.select_related("emotion").all()
        page = self.paginate_queryset(msgs)
        if page is not None:
            ser = MessageSerializer(page, many=True)
            return self.get_paginated_response(ser.data)
        return Response(MessageSerializer(msgs, many=True).data)

    @action(detail=True, methods=["post"])
    def send_message(self, request, pk=None):
        conv = self.get_object()
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"detail": "content required"}, status=status.HTTP_400_BAD_REQUEST)

        user_msg = Message.objects.create(conversation=conv, sender="user", content=content)
        analysis = emotion_detector.detect_emotion(content)

        EmotionAnalysis.objects.create(
            user=request.user,
            message=user_msg,
            primary_emotion=analysis["primary_emotion"],
            emotion_scores=analysis["emotion_scores"],
            emotion_vector=analysis["emotion_vector"],
            confidence=analysis["confidence"],
        )
        update_daily_mood(request.user)

        prior = list(
            conv.messages.exclude(pk=user_msg.pk)
            .select_related("emotion")
            .order_by("-created_at")[:20]
        )
        prior.reverse()
        history_for_ai = prior[-4:] if len(prior) > 4 else prior

        reply = _ai.generate_response(
            content,
            {
                "primary_emotion": analysis["primary_emotion"],
                "relationship_stage": conv.agent_relationship_stage,
            },
            conversation_history=history_for_ai,
            relationship_stage=conv.agent_relationship_stage,
        )
        Message.objects.create(conversation=conv, sender="bot", content=reply)

        msgs = conv.messages.select_related("emotion").all()
        return Response(MessageSerializer(msgs, many=True).data)
