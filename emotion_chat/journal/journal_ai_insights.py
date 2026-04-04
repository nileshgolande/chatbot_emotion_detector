"""Journal reflections via the same LLM provider chain as chat (Groq → OpenRouter → Gemini)."""
from __future__ import annotations

import copy
import json
import logging
import os
import re
from typing import Any

from services.llm_service import complete_chat_messages, _sanitize_llm_text

logger = logging.getLogger(__name__)

_JOURNAL_REFLECT_TOKENS = int(os.environ.get("JOURNAL_REFLECT_MAX_TOKENS", "380"))
_JOURNAL_DIGEST_TOKENS = int(os.environ.get("JOURNAL_DIGEST_MAX_TOKENS", "1024"))


def _journal_offline_hint() -> str:
    return (
        "I am with you. I could not reach an AI model from the server. "
        "Set the same keys you use for chat: GROQ_API_KEY, and/or OPENROUTER_API_KEY, "
        "and/or GEMINI_API_KEY or GOOGLE_API_KEY. Check LLM_ORDER in your environment."
    )


class JournalAIInsights:
    def generate_entry_insights(
        self,
        title: str,
        content: str,
        mood: str,
        *,
        user_display_name: str | None = None,
    ) -> str:
        name = (user_display_name or "").strip()
        name_line = f"The writer's name or username: {name}.\n" if name else ""
        system = (
            "You are a compassionate mental-wellness journal companion. "
            "Respond in 2-4 short sentences: name one theme from their words, "
            "a gentle reflection, and one small practical next step. "
            "Plain text only, no markdown headings or bullet labels. "
            "Do not diagnose or give medical advice."
        )
        user_parts = [
            name_line,
            f"Journal title: {title}",
            f"Mood hint: {mood}",
            f"They wrote:\n{(content or '')[:6000]}",
        ]
        user_msg = "\n".join(p for p in user_parts if p)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        raw = complete_chat_messages(messages, max_tokens=_JOURNAL_REFLECT_TOKENS)
        if raw:
            return _sanitize_llm_text(raw).strip()[:4000]
        logger.warning("Journal generate_entry_insights: all LLM providers failed")
        return _journal_offline_hint()

    def generate_period_insights(
        self,
        entries: list[Any],
        emotions_summary: dict[str, Any],
        period_type: str,
    ) -> dict[str, str]:
        titles = [getattr(e, "title", "") for e in entries[:50]]
        blob = "\n".join(f"- {t}" for t in titles if t)
        system = (
            "You summarize journal periods for a wellness app. "
            "Reply with two short paragraphs separated by a blank line: "
            "(1) patterns you notice, (2) compassionate, practical recommendations. "
            "Plain text, no markdown."
        )
        user_msg = (
            f"Period: {period_type}.\nSample entry titles:\n{blob or '(none)'}\n"
            f"Emotion summary from chat: {emotions_summary}"
        )
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg[:8000]},
        ]
        raw = complete_chat_messages(messages, max_tokens=_JOURNAL_DIGEST_TOKENS)
        if not raw:
            return {
                "patterns": "Keep journaling; patterns emerge over time.",
                "recommendations": "Rest, connect with supportive people, and revisit goals weekly.",
            }
        text = _sanitize_llm_text(raw).strip()
        parts = text.split("\n\n", 1)
        return {
            "patterns": parts[0][:2000],
            "recommendations": (parts[1] if len(parts) > 1 else "")[:2000] or text[:2000],
        }

    def enrich_daily_digest(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Optional LLM pass: richer headline, paragraphs, tags, quote, prompts, insight cards.
        Uses the same providers as chat. Falls back to heuristic payload on failure.
        """
        from .daily_digest import apply_llm_story_patch

        slim = {
            "date": payload.get("date"),
            "user_label": payload.get("user_label") or "",
            "dominant_emotion": payload.get("dominant_emotion"),
            "emotion_counts": payload.get("emotion_counts"),
            "timeline": (payload.get("timeline") or [])[:20],
            "existing_insights": (payload.get("insights") or [])[:4],
            "wellness_score": payload.get("wellness_score"),
            "messages_today": payload.get("messages_today"),
        }
        blob = json.dumps(slim, ensure_ascii=False)[:12000]
        system = (
            "You write warm, accurate daily journal copy for a mental wellness app.\n"
            "Reply with ONLY valid JSON (no markdown fences). Keys:\n"
            "headline (max 90 chars),\n"
            "badge_label (emoji + short mood label, e.g. '😐 Mostly neutral'),\n"
            "paragraphs (array of 2-4 short strings; use real timeline quotes when present; "
            "do not invent events absent from the JSON timeline),\n"
            "tags (array of up to 4 objects {\"text\", \"emotion\"} with emotion one of "
            "happy,sad,anxious,angry,neutral),\n"
            "quote (one empathetic line; you may address user_label by first name if it looks like a name),\n"
            "write_prompt (one reflection question),\n"
            "insights (array of up to 3 objects {\"icon\",\"title\",\"body\",\"tone\"} "
            "with tone one of purple,green,orange,slate; no medical diagnoses).\n"
            "Ground everything in the provided data."
        )
        user_msg = f"Day summary JSON for this user:\n{blob}"
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ]
        raw = complete_chat_messages(messages, max_tokens=_JOURNAL_DIGEST_TOKENS)
        if not raw:
            logger.warning("enrich_daily_digest: all LLM providers failed; keeping heuristic copy")
            return payload
        text = raw.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
        text = re.sub(r"\s*```\s*$", "", text)
        if not text:
            return payload
        return apply_llm_story_patch(copy.deepcopy(payload), text)


journal_ai = JournalAIInsights()
