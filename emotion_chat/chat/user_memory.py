"""
Per-user long-term chat memory (Postgres-backed).

This gives "one person" continuity across conversations: names and facts the user
shared in any thread are available in every other thread. The LLM is not an LSTM
trained inside this app — persistence is explicit state the model reads each turn
(same outcome users expect from recurrent memory without running PyTorch RNNs).
"""
from __future__ import annotations

import logging
import re
from typing import Any

from django.db import transaction
from django.db.models import Count

from emotions.models import EmotionAnalysis

from .models import Conversation, Message, UserChatMemory

logger = logging.getLogger(__name__)

_MAX_FACTS = 28
_MAX_FACT_LEN = 400


def _clean_name(s: str) -> str:
    t = (s or "").strip().rstrip(".,!?").strip("'\"")
    if len(t) < 2 or len(t) > 80:
        return ""
    # Skip obvious non-names
    if re.match(r"(?i)^(here|there|fine|ok|good|back|home|sure|sorry|happy|sad)$", t):
        return ""
    return t[:120]


def _append_fact(facts: list[Any], fact: str) -> list[str]:
    fact = " ".join(fact.split())[:_MAX_FACT_LEN]
    if len(fact) < 6:
        return [str(x) for x in facts] if facts else []
    out = [str(x) for x in (facts or []) if x]
    if fact in out:
        return out
    out.append(fact)
    return out[-_MAX_FACTS:]


def extract_and_merge_memory(user, message_text: str) -> None:
    """
    After a user message is stored: update UserChatMemory from lightweight patterns
    (name, 'remember that …'). Safe to call every turn; cheap.
    """
    text = (message_text or "").strip()
    if not text:
        return
    try:
        with transaction.atomic():
            mem, _ = UserChatMemory.objects.get_or_create(user=user)
            mem.user_message_count = (mem.user_message_count or 0) + 1

            # Preferred name
            name_patterns = [
                r"(?i)\b(?:my name is|my name's|i am|i'm|im|call me)\s+([A-Za-z][A-Za-z\s.'-]{1,60})(?:\s*[,.!?\n]|\s+and\b|\s*$)",
                r"(?i)\b(?:this is|it's|its)\s+([A-Za-z][A-Za-z\s.'-]{1,40})\s+(?:here|speaking)\b",
            ]
            for pat in name_patterns:
                m = re.search(pat, text)
                if m:
                    cand = _clean_name(m.group(1))
                    if cand:
                        mem.preferred_name = cand
                    break

            # "Remember that …" one-liners
            remember_re = re.compile(
                rf"(?i)\bremember\s+(?:that\s+)?([^.!?\n]{{8,{_MAX_FACT_LEN}}})(?:[.!?\n]|$)"
            )
            for m in remember_re.finditer(text):
                line = m.group(1).strip()
                mem.facts = _append_fact(mem.facts or [], line)

            um = mem.recent_emotions or []
            if isinstance(um, list) and len(um) > 50:
                mem.recent_emotions = um[-50:]

            mem.save()
    except Exception:
        logger.exception("extract_and_merge_memory failed user=%s", getattr(user, "pk", None))


def format_memory_for_prompt(mem: UserChatMemory | None) -> str:
    """Human-readable block injected into the system prompt."""
    if not mem:
        return ""
    lines: list[str] = [
        "Consistency: You are the same companion in every chat thread. Treat the "
        "following as true about this user until they correct you.",
    ]
    pn = (mem.preferred_name or "").strip()
    if pn:
        lines.append(f"They said to call them / their name is: {pn}.")
    facts = mem.facts or []
    if facts:
        lines.append("Things they asked you to remember (from any chat):")
        for f in facts[-18:]:
            lines.append(f"  • {f}")
    if len(lines) <= 1:
        return ""
    return "\n".join(lines)


def build_account_snapshot(user) -> str:
    """Factual aggregates from the DB when they ask for 'my data' / stats."""
    if not user or not getattr(user, "pk", None):
        return ""
    conv_n = Conversation.objects.filter(user=user).count()
    msg_n = Message.objects.filter(conversation__user=user).count()
    user_msgs = (
        Message.objects.filter(conversation__user=user, sender="user")
        .aggregate(c=Count("id"))
        .get("c")
        or 0
    )
    last_e = (
        EmotionAnalysis.objects.filter(user=user).order_by("-created_at").first()
    )
    mood = last_e.primary_emotion if last_e else "none recorded yet"
    joined = getattr(user, "date_joined", None)
    joined_s = joined.strftime("%Y-%m-%d") if joined else "unknown"
    return (
        "Account snapshot — use when they ask what you know, their stats, or 'all my data':\n"
        f"  • Login username: {user.username}\n"
        f"  • Account created (server): {joined_s}\n"
        f"  • Number of chat conversations: {conv_n}\n"
        f"  • Total messages (user + assistant) across all chats: {msg_n}\n"
        f"  • Their sent messages (user role only): {user_msgs}\n"
        f"  • Latest mood label from emotion analysis: {mood}\n"
    )


def build_llm_user_context(user) -> str:
    """
    Full extra system text: long-term memory + DB snapshot.
    """
    try:
        mem = UserChatMemory.objects.filter(user=user).first()
    except Exception:
        mem = None
    parts: list[str] = []
    mtxt = format_memory_for_prompt(mem)
    if mtxt:
        parts.append(mtxt)
    snap = build_account_snapshot(user)
    if snap:
        parts.append(snap)
    return "\n\n".join(parts).strip()
