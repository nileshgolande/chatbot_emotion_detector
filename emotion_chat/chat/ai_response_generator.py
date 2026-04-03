"""Empathic replies via compiled LangGraph (prepare → LLM → safe fallback)."""
from __future__ import annotations

import os
from typing import Any

from .langgraph_reply import run_empathy_graph


def _build_context(conversation_history: list[Any] | None, limit: int = 8) -> str:
    if not conversation_history:
        return ""
    tail = (
        conversation_history[-limit:]
        if len(conversation_history) > limit
        else conversation_history
    )
    lines = []
    for m in tail:
        if hasattr(m, "sender") and hasattr(m, "content"):
            role = "User" if m.sender == "user" else "Assistant"
            lines.append(f"{role}: {m.content[:500]}")
        elif isinstance(m, dict):
            role = "User" if m.get("sender") == "user" else "Assistant"
            lines.append(f"{role}: {str(m.get('content', ''))[:500]}")
    return "\n".join(lines)


def _resolve_gemini_key() -> str:
    key = (
        os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("GEMINI_API_KEY")
        or ""
    ).strip()
    if key:
        return key
    try:
        from django.conf import settings

        g = getattr(settings, "GEMINI_API_KEY", None)
        if g:
            return str(g).strip()
    except Exception:
        pass
    return ""


class AIResponseGenerator:
    """Thin facade: richer context window + keys passed into LangGraph."""

    def __init__(self) -> None:
        self._key_g = _resolve_gemini_key()
        self._key_o = (os.environ.get("OPENAI_API_KEY") or "").strip()

    def generate_response(
        self,
        user_message: str,
        emotion: dict[str, Any] | None,
        conversation_history: list[Any] | None = None,
        relationship_stage: str | None = None,
    ) -> str:
        emotion = emotion or {}
        primary = emotion.get("primary_emotion") or "neutral"
        stage = relationship_stage or emotion.get("relationship_stage") or "stranger"
        history = conversation_history or []
        hist_block = _build_context(history, limit=8)
        return run_empathy_graph(
            (user_message or "").strip(),
            primary,
            stage,
            hist_block,
            self._key_g,
            self._key_o,
        )


ai_generator = AIResponseGenerator()


def generate_reply(user_text: str, context: dict[str, Any] | None = None) -> str:
    context = context or {}
    history = context.get("conversation_history") or context.get("history")
    emotion = {
        "primary_emotion": context.get("primary_emotion"),
        "relationship_stage": context.get("relationship_stage"),
    }
    return ai_generator.generate_response(
        user_text,
        emotion,
        conversation_history=history,
        relationship_stage=context.get("relationship_stage"),
    )
