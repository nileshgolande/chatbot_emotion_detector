import logging

from django.conf import settings
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from emotions.emotion_detector import emotion_detector

logger = logging.getLogger(__name__)
from emotions.models import EmotionAnalysis
from services.llm_service import get_llm_response

from .daily_mood import update_daily_mood
from .models import Conversation, Message
from .serializers import (
    ConversationCreateSerializer,
    ConversationDetailSerializer,
    ConversationSerializer,
    MessageSerializer,
)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def llm_response_view(request):
    """Minimal LLM endpoint: message via GET query or POST JSON; returns { "response": ... }."""
    if request.method == "GET":
        user_input = (
            (request.query_params.get("message") or request.query_params.get("q") or "")
        ).strip()
    else:
        user_input = (
            (request.data.get("message") or request.data.get("content") or "")
        ).strip()
    if not user_input:
        return Response({"detail": "message required"}, status=status.HTTP_400_BAD_REQUEST)
    analysis = emotion_detector.detect_emotion(user_input)
    return Response(
        {"response": get_llm_response(user_input, analysis.get("primary_emotion"))}
    )


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

        try:
            user_msg = Message.objects.create(
                conversation=conv, sender="user", content=content
            )
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

            # Build short history window (last 5 messages before this one).
            prior = list(
                conv.messages.exclude(pk=user_msg.pk)
                .order_by("-created_at")[:5]
            )
            prior.reverse()

            reply = get_llm_response(
                content,
                analysis.get("primary_emotion"),
                history=prior,
            )
            Message.objects.create(conversation=conv, sender="bot", content=reply)

            msgs = conv.messages.select_related("emotion").all()
            return Response(MessageSerializer(msgs, many=True).data)
        except Exception as exc:
            logger.exception("send_message failed for user=%s conv=%s", request.user_id, pk)
            detail = str(exc) if settings.DEBUG else "Could not send message. Try again."
            return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
