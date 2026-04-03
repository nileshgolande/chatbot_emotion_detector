"""Gemini-powered journal reflections (compassionate, practical)."""
from __future__ import annotations

import logging
import os
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

_JOURNAL_GEMINI_MODEL = os.environ.get("JOURNAL_GEMINI_MODEL", "gemini-2.0-flash").strip()
_JOURNAL_MAX_OUT = int(os.environ.get("JOURNAL_MAX_OUTPUT_TOKENS", "512"))
# Reuse chat client per (api_key, temperature) — constructing LangChain LLMs per request is slow.
_journal_llm_cache: dict[tuple[str, float], Any] = {}


def _journal_llm(key: str, temperature: float):
    t = round(float(temperature), 2)
    cache_key = (key, t)
    if cache_key not in _journal_llm_cache:
        from langchain_google_genai import ChatGoogleGenerativeAI

        _journal_llm_cache[cache_key] = ChatGoogleGenerativeAI(
            model=_JOURNAL_GEMINI_MODEL,
            google_api_key=key,
            temperature=t,
            max_output_tokens=_JOURNAL_MAX_OUT,
        )
    return _journal_llm_cache[cache_key]


def _gemini_key() -> str:
    return (
        (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
        or os.environ.get("GOOGLE_API_KEY", "")
        or ""
    ).strip()


class JournalAIInsights:
    def generate_entry_insights(self, title: str, content: str, mood: str) -> str:
        key = _gemini_key()
        prompt = (
            f"Journal title: {title}\n"
            f"Mood tag: {mood}\n"
            f"Entry:\n{content[:6000]}\n\n"
            "Respond in 2-4 short sentences: name one theme, gentle reflection, "
            "one practical next step. Plain text, no markdown headings."
        )
        if not key:
            return (
                f"Insights (offline): your entry “{title[:80]}” is saved with mood “{mood}”. "
                "Set GEMINI_API_KEY or GOOGLE_API_KEY for AI-generated insights."
            )
        try:
            from langchain_core.messages import HumanMessage

            llm = _journal_llm(key, 0.55)
            out = llm.invoke([HumanMessage(content=prompt)])
            return (out.content or "").strip()[:4000]
        except Exception as e:
            logger.warning("Journal entry insights: %s", e)
            return "Your entry was saved; AI insights are temporarily unavailable."

    def generate_period_insights(
        self,
        entries: list[Any],
        emotions_summary: dict[str, Any],
        period_type: str,
    ) -> dict[str, str]:
        key = _gemini_key()
        titles = [getattr(e, "title", "") for e in entries[:50]]
        blob = "\n".join(f"- {t}" for t in titles if t)
        prompt = (
            f"Period: {period_type}. Sample entry titles:\n{blob}\n"
            f"Emotion summary (from chat): {emotions_summary}\n"
            "Return two short paragraphs: (1) patterns you notice, (2) compassionate recommendations."
        )
        if not key:
            return {
                "patterns": "Keep journaling; patterns emerge over time.",
                "recommendations": "Rest, connect with supportive people, and revisit goals weekly.",
            }
        try:
            from langchain_core.messages import HumanMessage

            llm = _journal_llm(key, 0.5)
            out = llm.invoke([HumanMessage(content=prompt)])
            text = (out.content or "").strip()
            parts = text.split("\n\n", 1)
            return {
                "patterns": parts[0][:2000],
                "recommendations": (parts[1] if len(parts) > 1 else "")[:2000] or text[:2000],
            }
        except Exception as e:
            logger.warning("Journal period insights: %s", e)
            return {
                "patterns": "Unable to analyze this period right now.",
                "recommendations": "Continue journaling; try again later.",
            }


journal_ai = JournalAIInsights()
