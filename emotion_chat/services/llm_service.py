"""
Multi-provider LLM calls with ordered fallback (Gemini → Groq → OpenRouter).
Sync-only API; safe to wrap in async tasks later (e.g. asyncio.to_thread).
"""
from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

# project root: emotion_chat/ (same folder as manage.py and .env)
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVICE_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = int(os.environ.get("LLM_HTTP_TIMEOUT", "30"))

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# llama3-70b-8192 was retired on Groq; use current production id.
GROQ_MODEL = (os.environ.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()
OPENROUTER_MODEL = "mistralai/mistral-7b-instruct"

SYSTEM_PROMPT = """You are an emotion-aware conversational assistant. You recognize and respond appropriately when the user seems happy, sad, angry, or anxious—acknowledge feelings without being patronizing.

Tone: warm, friendly, and human-like. Keep replies concise but meaningful. For technical or factual questions, give structured, clear answers (short paragraphs or bullet points when helpful).

Stay helpful and safe; do not claim to be human.

Do not include meta commentary like "(You shared: ...)" or other "you shared" summaries. Reply directly as the assistant."""

EMOTION_FALLBACK_MESSAGES: dict[str, str] = {
    "happy": (
        "I'm so glad to hear that! My system is having a quick hiccup, "
        "but I’m definitely sharing in your good vibes right now."
    ),
    "sad": (
        "I’m really sorry you’re feeling this way. I’m having a little trouble "
        "processing my next thought, but I’m here with you."
    ),
    "anxious": (
        "I can tell things feel a bit much right now. I’m experiencing a small "
        "technical lag, but let’s take a breath while I get back on track."
    ),
    "angry": (
        "I hear your frustration, and I’m sorry if I’m adding to it with a "
        "technical delay. I'm trying my best to reconnect so we can work through this."
    ),
    "neutral": (
        "I've noted that. My connection is a bit spotty at the moment, "
        "but I'm still tuned into what you're saying."
    ),
}


def _strip_env_value(val: str | None) -> str:
    if not val:
        return ""
    v = val.strip().strip("'").strip('"')
    return v


def gemini_api_key() -> str:
    return _strip_env_value(
        os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    )


def groq_api_key() -> str:
    return _strip_env_value(os.environ.get("GROQ_API_KEY"))


def openrouter_api_key() -> str:
    return _strip_env_value(os.environ.get("OPENROUTER_API_KEY"))


def gemini_model_candidates() -> list[str]:
    """
    GEMINI_MODEL may be one id or comma-separated fallbacks, e.g.
    gemini-2.0-flash,gemini-1.5-flash
    (A single string like "a,b,c" must NOT be sent as one model name to the API.)
    """
    raw = _strip_env_value(os.environ.get("GEMINI_MODEL")) or (
        "gemini-2.0-flash,gemini-1.5-flash"
    )
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    # Allow only safe model id characters
    out = []
    for m in parts:
        m = m.strip()
        if m and re.match(r"^[\w.\-]+$", m):
            out.append(m)
    return out or ["gemini-2.0-flash", "gemini-1.5-flash"]


def _safe_json(resp: requests.Response) -> Any | None:
    try:
        return resp.json()
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Invalid JSON from LLM HTTP response: %s", exc)
        return None


def _sanitize_llm_text(text: str) -> str:
    """
    Remove unwanted meta lines that some LLMs produce (e.g. "(You shared: ...)")
    so the UI feels like a human conversation.
    """
    if not text:
        return ""
    t = text.replace("\r\n", "\n").strip()

    # Remove any line containing "(You shared: ...)" entirely.
    t = re.sub(
        r"^\s*\(You shared:\s*.*?\)\s*$",
        "",
        t,
        flags=re.IGNORECASE | re.MULTILINE,
    )
    # Remove any "(You shared: ...)" occurrence even if it spans lines.
    t = re.sub(
        r"\(You shared:\s*.*?\)",
        "",
        t,
        flags=re.IGNORECASE | re.DOTALL,
    )
    # Remove "You shared:" lines (without parentheses) just in case.
    t = re.sub(
        r"^\s*You shared:\s*.*$",
        "",
        t,
        flags=re.IGNORECASE | re.MULTILINE,
    )

    # Collapse extra blank lines.
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t


def _call_gemini_one_model(prompt: str, model_id: str, api_key: str) -> str | None:
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_id}:generateContent?key={api_key}"
    )
    payload: dict[str, Any] = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        r = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=REQUEST_TIMEOUT,
        )
    except requests.Timeout as exc:
        logger.warning("Gemini timeout (%s): %s", model_id, exc)
        print(f"[LLM] Gemini failure ({model_id}): timeout ({exc})")
        return None
    except requests.RequestException as exc:
        logger.warning("Gemini request error (%s): %s", model_id, exc)
        print(f"[LLM] Gemini failure ({model_id}): request error ({exc})")
        return None

    if r.status_code >= 400:
        logger.warning("Gemini HTTP %s (%s): %s", r.status_code, model_id, r.text[:500])
        print(f"[LLM] Gemini failure ({model_id}): HTTP {r.status_code}")
        return None

    data = _safe_json(r)
    if not isinstance(data, dict):
        print(f"[LLM] Gemini failure ({model_id}): invalid JSON structure")
        return None

    try:
        candidates = data.get("candidates") or []
        if not candidates:
            print(f"[LLM] Gemini failure ({model_id}): no candidates in response")
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        if not parts:
            print(f"[LLM] Gemini failure ({model_id}): no content parts")
            return None
        text = parts[0].get("text")
    except (TypeError, KeyError, IndexError) as exc:
        logger.warning("Gemini unexpected JSON shape (%s): %s", model_id, exc)
        print(f"[LLM] Gemini failure ({model_id}): unexpected JSON structure ({exc})")
        return None

    if isinstance(text, str) and text.strip():
        print(f"[LLM] Gemini success with model: {model_id}")
        return text.strip()
    return None


def call_gemini(prompt: str) -> str | None:
    """Call Google Gemini REST API; try each GEMINI_MODEL candidate until one works."""
    api_key = gemini_api_key()
    if not api_key:
        msg = "GEMINI_API_KEY / GOOGLE_API_KEY not set"
        logger.warning(msg)
        print(f"[LLM] Gemini failure: {msg}")
        return None

    models = gemini_model_candidates()
    print(f"[LLM] Gemini models to try: {', '.join(models)}")
    for mid in models:
        out = _call_gemini_one_model(prompt, mid, api_key)
        if out:
            return out
    return None


def call_groq(prompt: str) -> str | None:
    """Groq OpenAI-compatible chat completions; return text or None."""
    key = groq_api_key()
    if not key:
        msg = "GROQ_API_KEY not set"
        logger.warning(msg)
        print(f"[LLM] Groq failure: {msg}")
        return None
    body = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    try:
        r = requests.post(
            GROQ_CHAT_URL,
            json=body,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.Timeout as exc:
        logger.warning("Groq timeout: %s", exc)
        print(f"[LLM] Groq failure: timeout ({exc})")
        return None
    except requests.RequestException as exc:
        logger.warning("Groq request error: %s", exc)
        print(f"[LLM] Groq failure: request error ({exc})")
        return None

    if r.status_code >= 400:
        logger.warning("Groq HTTP %s: %s", r.status_code, r.text[:500])
        print(f"[LLM] Groq failure: HTTP {r.status_code}")
        return None

    data = _safe_json(r)
    if not isinstance(data, dict):
        print("[LLM] Groq failure: invalid JSON structure")
        return None

    try:
        choices = data.get("choices") or []
        msg = (choices[0].get("message") or {}).get("content")
    except (TypeError, KeyError, IndexError) as exc:
        logger.warning("Groq unexpected JSON shape: %s", exc)
        print(f"[LLM] Groq failure: unexpected JSON structure ({exc})")
        return None

    if isinstance(msg, str) and msg.strip():
        return msg.strip()
    return None


def call_openrouter(prompt: str) -> str | None:
    """OpenRouter chat completions (free-tier model); return text or None."""
    key = openrouter_api_key()
    if not key:
        msg = "OPENROUTER_API_KEY not set"
        logger.warning(msg)
        print(f"[LLM] OpenRouter failure: {msg}")
        return None
    body = {
        "model": OPENROUTER_MODEL,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Referer": os.environ.get("OPENROUTER_REFERRER", "http://localhost:8000"),
        "X-Title": "Emotion Chat",
    }
    try:
        r = requests.post(
            OPENROUTER_CHAT_URL,
            json=body,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.Timeout as exc:
        logger.warning("OpenRouter timeout: %s", exc)
        print(f"[LLM] OpenRouter failure: timeout ({exc})")
        return None
    except requests.RequestException as exc:
        logger.warning("OpenRouter request error: %s", exc)
        print(f"[LLM] OpenRouter failure: request error ({exc})")
        return None

    if r.status_code >= 400:
        logger.warning("OpenRouter HTTP %s: %s", r.status_code, r.text[:500])
        print(f"[LLM] OpenRouter failure: HTTP {r.status_code}")
        return None

    data = _safe_json(r)
    if not isinstance(data, dict):
        print("[LLM] OpenRouter failure: invalid JSON structure")
        return None

    try:
        choices = data.get("choices") or []
        msg_out = (choices[0].get("message") or {}).get("content")
    except (TypeError, KeyError, IndexError) as exc:
        logger.warning("OpenRouter unexpected JSON shape: %s", exc)
        print(f"[LLM] OpenRouter failure: unexpected JSON structure ({exc})")
        return None

    if isinstance(msg_out, str) and msg_out.strip():
        return msg_out.strip()
    return None


def get_llm_response(user_input: str, primary_emotion: str | None = None) -> str:
    """
    Build prompt with SYSTEM_PROMPT, try Gemini (retry = second full pass), then Groq, then OpenRouter.
    Returns first non-empty model text, or emotion-specific fallback if all fail.
    """
    text = (user_input or "").strip()
    if not text:
        return "Please send a non-empty message."

    final_prompt = SYSTEM_PROMPT + "\nUser: " + text

    logger.info("LLM pipeline: trying Gemini (attempt 1)")
    print("[LLM] Using API: Gemini (attempt 1)")
    out = call_gemini(final_prompt)
    if out:
        return _sanitize_llm_text(out)

    logger.warning("LLM: Gemini attempt 1 failed; retrying Gemini once")
    print("[LLM] Fallback: retrying Gemini (attempt 2)")
    out = call_gemini(final_prompt)
    if out:
        return _sanitize_llm_text(out)

    logger.warning("LLM: Gemini exhausted; falling back to Groq")
    print("[LLM] Fallback: switching to Groq")
    out = call_groq(final_prompt)
    if out:
        return _sanitize_llm_text(out)

    logger.warning("LLM: Groq failed; falling back to OpenRouter")
    print("[LLM] Fallback: switching to OpenRouter")
    out = call_openrouter(final_prompt)
    if out:
        return _sanitize_llm_text(out)

    logger.error("LLM: all providers failed")
    print("[LLM] All providers failed; returning emotion-aware graceful error message")
    key = (primary_emotion or "").lower()
    if key not in EMOTION_FALLBACK_MESSAGES:
        key = "neutral"
    return EMOTION_FALLBACK_MESSAGES[key]