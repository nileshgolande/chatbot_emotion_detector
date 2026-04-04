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

from chat.empathy_prompts import build_chat_system_prompt

# project root: emotion_chat/ (same folder as manage.py and .env)
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVICE_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = int(os.environ.get("LLM_HTTP_TIMEOUT", "12"))
# Room for empathy-first system prompt + last turns + user (default was 6000; prompt grew).
LLM_MAX_CONTEXT_CHARS = int(os.environ.get("LLM_MAX_CONTEXT_CHARS", "10000"))

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# llama3-70b-8192 was retired on Groq; use current production id.
GROQ_MODEL = (os.environ.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()

# OpenRouter: fewer defaults = faster failover (extend via OPENROUTER_MODELS in .env).
OPENROUTER_MODELS = [
    m.strip()
    for m in os.environ.get(
        "OPENROUTER_MODELS",
        (
            "meta-llama/llama-3.1-8b-instruct:free,"
            "google/gemma-3-4b-it:free"
        ),
    ).split(",")
    if m.strip()
]

# Short, human-like replies; raise via CHAT_MAX_TOKENS or OPENROUTER_MAX_TOKENS if needed.
CHAT_MAX_TOKENS = int(
    os.environ.get("CHAT_MAX_TOKENS")
    or os.environ.get("OPENROUTER_MAX_TOKENS")
    or "180"
)
OPENROUTER_MAX_TOKENS = CHAT_MAX_TOKENS

# Provider order for chat (first successful response wins). Groq is usually lowest latency.
_LLM_ORDER_RAW = os.environ.get("LLM_ORDER", "groq,openrouter,gemini")
LLM_ORDER = [p.strip().lower() for p in _LLM_ORDER_RAW.split(",") if p.strip()]

EMOTION_FALLBACK_MESSAGES: dict[str, str] = {
    "happy": (
        "💛✨ I’m so happy you shared that — I’m getting a small technical hiccup on my side, "
        "but I’m right here cheering you on and soaking up your good energy. 🌟🤗"
    ),
    "sad": (
        "🫂 I’m really sorry things feel heavy right now. I hit a brief snag replying, "
        "but you’re not alone in this moment — I’m with you. 🌙"
    ),
    "anxious": (
        "🌿🫧 I can tell it’s a lot right now. I had a tiny delay on my end—want to take one slow breath "
        "together while I catch up? I’ve got you. 🌊✨"
    ),
    "angry": (
        "🕊️💬 I hear your frustration, and it makes sense. I’m sorry a technical delay piled on—I’m "
        "working to get back so we can talk it through properly. 🙏🌱"
    ),
    "neutral": (
        "💬 I’m here and I’m listening. Connection flickered for a second, but what you said still "
        "matters to me—thanks for your patience. ✨"
    ),
}

GEMINI_API_VERSIONS = [
    v.strip()
    for v in os.environ.get("GEMINI_API_VERSIONS", "v1,v1beta").split(",")
    if v.strip()
]


def _strip_env_value(val: str | None) -> str:
    if not val:
        return ""
    v = val.strip().strip("'").strip('"')
    return v


def gemini_api_key() -> str:
    return _strip_env_value(
        os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    )


def _invalid_groq_key(key: str) -> bool:
    """True if key is empty or a tutorial placeholder (e.g. gsk_...abc)."""
    if not key:
        return True
    if "..." in key:
        logger.warning(
            "GROQ_API_KEY contains '...' — replace with your full key from https://console.groq.com/keys"
        )
        return True
    return False


def _invalid_openrouter_key(key: str) -> bool:
    if not key:
        return True
    if "..." in key:
        logger.warning(
            "OPENROUTER_API_KEY contains '...' — replace with your full key from https://openrouter.ai/keys"
        )
        return True
    return False


def groq_api_key() -> str:
    k = _strip_env_value(os.environ.get("GROQ_API_KEY"))
    return "" if _invalid_groq_key(k) else k


def openrouter_api_key() -> str:
    k = _strip_env_value(os.environ.get("OPENROUTER_API_KEY"))
    return "" if _invalid_openrouter_key(k) else k


def gemini_model_candidates() -> list[str]:
    """
    GEMINI_MODEL may be one id or comma-separated fallbacks, e.g.
    gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash
    (A single string like "a,b,c" must NOT be sent as one model name to the API.)
    """
    raw = _strip_env_value(os.environ.get("GEMINI_MODEL")) or (
        "gemini-2.5-flash,"
        "gemini-2.0-flash,"
        "gemini-2.0-flash-001,"
        "gemini-1.5-flash,"
        "gemini-1.5-flash-8b,"
        "gemini-1.5-pro"
    )
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    # Allow only safe model id characters
    out = []
    for m in parts:
        m = m.strip()
        if m and re.match(r"^[\w.\-]+$", m):
            out.append(m)
    return out or [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-pro",
    ]


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


def _build_chat_messages(
    user_input: str, history: list[Any] | None, system_prompt: str
) -> list[dict[str, str]]:
    """
    Build an OpenRouter-compatible messages list with:
    - system message
    - up to last 5 history turns
    - current user message
    Each content is trimmed so overall text stays well under token limits.
    """
    msgs: list[dict[str, str]] = []
    total_chars = 0
    cap = LLM_MAX_CONTEXT_CHARS

    def _add(role: str, content: str) -> None:
        nonlocal total_chars
        if not content:
            return
        if total_chars >= cap:
            return
        # Hard cap each segment and overall length.
        allowed = cap - total_chars
        snippet = content[: allowed]
        if not snippet:
            return
        msgs.append({"role": role, "content": snippet})
        total_chars += len(snippet)

    _add("system", system_prompt)

    if history:
        # Keep only last 5 messages from history.
        tail = history[-5:]
        for item in tail:
            role = "user"
            text = ""
            if hasattr(item, "sender") and hasattr(item, "content"):
                role = "user" if getattr(item, "sender") == "user" else "assistant"
                text = str(getattr(item, "content") or "")
            elif isinstance(item, dict):
                role = "user" if (item.get("sender") or "user") == "user" else "assistant"
                text = str(item.get("content") or "")
            _add(role, text)

    _add("user", user_input)
    return msgs


def _call_gemini_one_model(
    prompt: str,
    model_id: str,
    api_key: str,
    max_output_tokens: int | None = None,
) -> str | None:
    cap = max_output_tokens if max_output_tokens is not None else CHAT_MAX_TOKENS
    # Gemini expects a "contents" list with role + parts.
    payload: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max(64, min(int(cap), 8192))},
    }

    for api_version in GEMINI_API_VERSIONS:
        url = (
            f"https://generativelanguage.googleapis.com/{api_version}/models/"
            f"{model_id}:generateContent?key={api_key}"
        )
        try:
            r = requests.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.Timeout as exc:
            logger.warning("Gemini timeout (%s, %s): %s", model_id, api_version, exc)
            print(f"[LLM] Gemini failure ({model_id}): timeout ({exc})")
            continue
        except requests.RequestException as exc:
            logger.warning("Gemini request error (%s, %s): %s", model_id, api_version, exc)
            print(f"[LLM] Gemini failure ({model_id}): request error ({exc})")
            continue

        if r.status_code >= 400:
            logger.warning(
                "Gemini HTTP %s (%s, %s): %s",
                r.status_code,
                model_id,
                api_version,
                r.text[:500],
            )
            print(f"[LLM] Gemini failure ({model_id}): HTTP {r.status_code}")
            continue

        data = _safe_json(r)
        if not isinstance(data, dict):
            print(f"[LLM] Gemini failure ({model_id}): invalid JSON structure")
            continue

        try:
            candidates = data.get("candidates") or []
            if not candidates:
                fb = data.get("promptFeedback") or data.get("error")
                if fb:
                    logger.warning(
                        "Gemini no candidates (%s, %s): %s",
                        model_id,
                        api_version,
                        fb,
                    )
                    print(f"[LLM] Gemini ({model_id}): no candidates — {fb}")
                else:
                    print(f"[LLM] Gemini failure ({model_id}): no candidates in response")
                continue
            parts = (candidates[0].get("content") or {}).get("parts") or []
            if not parts:
                print(f"[LLM] Gemini failure ({model_id}): no content parts")
                continue
            text = parts[0].get("text")
        except (TypeError, KeyError, IndexError) as exc:
            logger.warning("Gemini unexpected JSON shape (%s, %s): %s", model_id, api_version, exc)
            print(f"[LLM] Gemini failure ({model_id}): unexpected JSON structure ({exc})")
            continue

        if isinstance(text, str) and text.strip():
            print(f"[LLM] Gemini success with model: {model_id}")
            return text.strip()

    return None


def _messages_to_gemini_prompt(messages: list[dict[str, str]]) -> str:
    """Flatten chat messages into one Gemini user prompt."""
    parts: list[str] = []
    for m in messages:
        role = (m.get("role") or "user").strip().lower()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "system":
            parts.append(f"Instructions:\n{content}")
        elif role == "assistant":
            parts.append(f"Assistant:\n{content}")
        else:
            parts.append(f"User:\n{content}")
    return "\n\n".join(parts)[: LLM_MAX_CONTEXT_CHARS]


def call_gemini(prompt: str, max_output_tokens: int | None = None) -> str | None:
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
        out = _call_gemini_one_model(prompt, mid, api_key, max_output_tokens)
        if out:
            return out
    return None


def call_groq_chat(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """Groq OpenAI-compatible chat completions with full message history."""
    key = groq_api_key()
    if not key:
        msg = "GROQ_API_KEY not set"
        logger.warning(msg)
        print(f"[LLM] Groq failure: {msg}")
        return None
    mt = int(max_tokens) if max_tokens is not None else CHAT_MAX_TOKENS
    body = {
        "model": GROQ_MODEL,
        "messages": messages,
        "max_tokens": max(32, min(mt, 8192)),
        "temperature": float(os.environ.get("GROQ_TEMPERATURE", "0.45")),
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


def call_groq(prompt: str) -> str | None:
    """Single user-message convenience wrapper."""
    return call_groq_chat([{"role": "user", "content": prompt}])


def call_openrouter_chat(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """
    OpenRouter chat completions (free-tier models) with multi-model fallback.
    - messages: OpenAI-style chat messages, already trimmed.
    - Tries each model in OPENROUTER_MODELS in order.
    - max_tokens from CHAT_MAX_TOKENS (default 220; env CHAT_MAX_TOKENS or OPENROUTER_MAX_TOKENS).
    """
    key = openrouter_api_key()
    if not key:
        msg = "OPENROUTER_API_KEY not set"
        logger.warning(msg)
        print(f"[LLM] OpenRouter failure: {msg}")
        return None
    mt = int(max_tokens) if max_tokens is not None else OPENROUTER_MAX_TOKENS
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.environ.get("OPENROUTER_REFERRER", "http://localhost:8000"),
        "X-Title": "Emotion Chat",
    }
    for model_id in OPENROUTER_MODELS:
        body = {
            "model": model_id,
            "messages": messages,
            "max_tokens": max(32, min(mt, 8192)),
            "temperature": float(os.environ.get("OPENROUTER_TEMPERATURE", "0.45")),
        }
        try:
            r = requests.post(
                OPENROUTER_CHAT_URL,
                json=body,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
        except requests.Timeout as exc:
            logger.warning("OpenRouter timeout (%s): %s", model_id, exc)
            print(f"[LLM] OpenRouter failure ({model_id}): timeout ({exc})")
            continue
        except requests.RequestException as exc:
            logger.warning("OpenRouter request error (%s): %s", model_id, exc)
            print(f"[LLM] OpenRouter failure ({model_id}): request error ({exc})")
            continue

        if r.status_code >= 400:
            logger.warning(
                "OpenRouter HTTP %s (%s): %s",
                r.status_code,
                model_id,
                r.text[:500],
            )
            print(f"[LLM] OpenRouter failure ({model_id}): HTTP {r.status_code}")
            continue

        data = _safe_json(r)
        if not isinstance(data, dict):
            print(f"[LLM] OpenRouter failure ({model_id}): invalid JSON structure")
            continue

        try:
            choices = data.get("choices") or []
            msg_out = (choices[0].get("message") or {}).get("content")
        except (TypeError, KeyError, IndexError) as exc:
            logger.warning("OpenRouter unexpected JSON shape (%s): %s", model_id, exc)
            print(f"[LLM] OpenRouter failure ({model_id}): unexpected JSON structure ({exc})")
            continue

        if isinstance(msg_out, str) and msg_out.strip():
            print(f"[LLM] OpenRouter success with model: {model_id}")
            return msg_out.strip()

    return None


def complete_chat_messages(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """
    Run the same provider chain as chat (LLM_ORDER: Groq → OpenRouter → Gemini).
    Use for journal / structured prompts. Returns None if every provider fails.
    """
    mt = int(max_tokens) if max_tokens is not None else CHAT_MAX_TOKENS
    capped: list[dict[str, str]] = []
    budget = LLM_MAX_CONTEXT_CHARS
    used = 0
    for m in messages:
        role = m.get("role") or "user"
        content = m.get("content") or ""
        take = content[: max(0, budget - used)]
        if not take.strip():
            continue
        capped.append({"role": role, "content": take})
        used += len(take)
    if not capped:
        return None
    gemini_prompt = _messages_to_gemini_prompt(capped)
    order = LLM_ORDER or ["groq", "openrouter", "gemini"]
    for provider in order:
        if provider == "openrouter":
            logger.info("Journal LLM: OpenRouter")
            out = call_openrouter_chat(capped, max_tokens=mt)
            if out:
                return out
        elif provider == "gemini":
            logger.info("Journal LLM: Gemini")
            out = call_gemini(gemini_prompt, max_output_tokens=mt)
            if out:
                return out
        elif provider == "groq":
            logger.info("Journal LLM: Groq")
            out = call_groq_chat(capped, max_tokens=mt)
            if out:
                return out
        else:
            logger.warning("LLM_ORDER unknown provider %r — skipped", provider)
    return None


def get_llm_response(
    user_input: str,
    primary_emotion: str | None = None,
    history: list[Any] | None = None,
) -> str:
    """
    Build chat prompt; try providers in LLM_ORDER (default: Groq → OpenRouter → Gemini).
    One call per provider where applicable (no duplicate Gemini retries).
    """
    text = (user_input or "").strip()
    if not text:
        return "Please send a non-empty message."

    # Trim raw text defensively.
    text = text[:6000]
    system_prompt = build_chat_system_prompt(primary_emotion)
    final_prompt = system_prompt + "\n\nUser:\n" + text

    try:
        chat_messages = _build_chat_messages(text, history, system_prompt)
    except Exception:
        chat_messages = _build_chat_messages(text, None, system_prompt)

    order = LLM_ORDER or ["groq", "openrouter", "gemini"]
    for provider in order:
        if provider == "openrouter":
            logger.info("LLM pipeline: OpenRouter")
            print("[LLM] Using API: OpenRouter")
            out = call_openrouter_chat(chat_messages)
            if out:
                return _sanitize_llm_text(out)
        elif provider == "gemini":
            logger.info("LLM pipeline: Gemini")
            print("[LLM] Using API: Gemini")
            out = call_gemini(final_prompt)
            if out:
                return _sanitize_llm_text(out)
        elif provider == "groq":
            logger.info("LLM pipeline: Groq")
            print("[LLM] Using API: Groq")
            out = call_groq_chat(chat_messages)
            if out:
                return _sanitize_llm_text(out)
        else:
            logger.warning("LLM_ORDER unknown provider %r — skipped", provider)

    logger.error("LLM: all providers failed")
    print("[LLM] All providers failed; returning emotion-aware graceful error message")
    key = (primary_emotion or "").lower()
    if key not in EMOTION_FALLBACK_MESSAGES:
        key = "neutral"
    return EMOTION_FALLBACK_MESSAGES[key]