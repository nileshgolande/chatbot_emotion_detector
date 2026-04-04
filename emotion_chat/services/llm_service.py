# """
# Multi-provider LLM calls with ordered fallback (Gemini → Groq → OpenRouter).
# Sync-only API; safe to wrap in async tasks later (e.g. asyncio.to_thread).
# """
# from __future__ import annotations

# import json
# import logging
# import os
# import re
# from pathlib import Path
# from typing import Any

# import requests
# from dotenv import load_dotenv

# from chat.empathy_prompts import build_chat_system_prompt

# # project root: emotion_chat/ (same folder as manage.py and .env)
# _SERVICE_ROOT = Path(__file__).resolve().parent.parent
# load_dotenv(_SERVICE_ROOT / ".env")
# load_dotenv()

# logger = logging.getLogger(__name__)

# REQUEST_TIMEOUT = int(os.environ.get("LLM_HTTP_TIMEOUT", "12"))
# # Room for empathy-first system prompt + last turns + user (default was 6000; prompt grew).
# LLM_MAX_CONTEXT_CHARS = int(os.environ.get("LLM_MAX_CONTEXT_CHARS", "10000"))

# GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
# OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# # llama3-70b-8192 was retired on Groq; use current production id.
# GROQ_MODEL = (os.environ.get("GROQ_MODEL") or "llama-3.3-70b-versatile").strip()

# # OpenRouter: fewer defaults = faster failover (extend via OPENROUTER_MODELS in .env).
# OPENROUTER_MODELS = [
#     m.strip()
#     for m in os.environ.get(
#         "OPENROUTER_MODELS",
#         (
#             "meta-llama/llama-3.1-8b-instruct:free,"
#             "google/gemma-3-4b-it:free"
#         ),
#     ).split(",")
#     if m.strip()
# ]

# # Short, human-like replies; raise via CHAT_MAX_TOKENS or OPENROUTER_MAX_TOKENS if needed.
# CHAT_MAX_TOKENS = int(
#     os.environ.get("CHAT_MAX_TOKENS")
#     or os.environ.get("OPENROUTER_MAX_TOKENS")
#     or "180"
# )
# OPENROUTER_MAX_TOKENS = CHAT_MAX_TOKENS

# # Provider order for chat (first successful response wins). Groq is usually lowest latency.
# _LLM_ORDER_RAW = os.environ.get("LLM_ORDER", "groq,openrouter,gemini")
# LLM_ORDER = [p.strip().lower() for p in _LLM_ORDER_RAW.split(",") if p.strip()]

# EMOTION_FALLBACK_MESSAGES: dict[str, str] = {
#     "happy": (
#         "💛✨ I’m so happy you shared that — I’m getting a small technical hiccup on my side, "
#         "but I’m right here cheering you on and soaking up your good energy. 🌟🤗"
#     ),
#     "sad": (
#         "🫂 I’m really sorry things feel heavy right now. I hit a brief snag replying, "
#         "but you’re not alone in this moment — I’m with you. 🌙"
#     ),
#     "anxious": (
#         "🌿🫧 I can tell it’s a lot right now. I had a tiny delay on my end—want to take one slow breath "
#         "together while I catch up? I’ve got you. 🌊✨"
#     ),
#     "angry": (
#         "🕊️💬 I hear your frustration, and it makes sense. I’m sorry a technical delay piled on—I’m "
#         "working to get back so we can talk it through properly. 🙏🌱"
#     ),
#     "neutral": (
#         "💬 I’m here and I’m listening. Connection flickered for a second, but what you said still "
#         "matters to me—thanks for your patience. ✨"
#     ),
# }

# GEMINI_API_VERSIONS = [
#     v.strip()
#     for v in os.environ.get("GEMINI_API_VERSIONS", "v1,v1beta").split(",")
#     if v.strip()
# ]


# def _strip_env_value(val: str | None) -> str:
#     if not val:
#         return ""
#     v = val.strip().strip("'").strip('"')
#     return v


# def gemini_api_key() -> str:
#     return _strip_env_value(
#         os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
#     )


# def _invalid_groq_key(key: str) -> bool:
#     """True if key is empty or a tutorial placeholder (e.g. gsk_...abc)."""
#     if not key:
#         return True
#     if "..." in key:
#         logger.warning(
#             "GROQ_API_KEY contains '...' — replace with your full key from https://console.groq.com/keys"
#         )
#         return True
#     return False


# def _invalid_openrouter_key(key: str) -> bool:
#     if not key:
#         return True
#     if "..." in key:
#         logger.warning(
#             "OPENROUTER_API_KEY contains '...' — replace with your full key from https://openrouter.ai/keys"
#         )
#         return True
#     return False


# def groq_api_key() -> str:
#     k = _strip_env_value(os.environ.get("GROQ_API_KEY"))
#     return "" if _invalid_groq_key(k) else k


# def openrouter_api_key() -> str:
#     k = _strip_env_value(os.environ.get("OPENROUTER_API_KEY"))
#     return "" if _invalid_openrouter_key(k) else k


# def gemini_model_candidates() -> list[str]:
#     """
#     GEMINI_MODEL may be one id or comma-separated fallbacks, e.g.
#     gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash
#     (A single string like "a,b,c" must NOT be sent as one model name to the API.)
#     """
#     raw = _strip_env_value(os.environ.get("GEMINI_MODEL")) or (
#         "gemini-2.5-flash,"
#         "gemini-2.0-flash,"
#         "gemini-2.0-flash-001,"
#         "gemini-1.5-flash,"
#         "gemini-1.5-flash-8b,"
#         "gemini-1.5-pro"
#     )
#     parts = [p.strip() for p in raw.split(",") if p.strip()]
#     # Allow only safe model id characters
#     out = []
#     for m in parts:
#         m = m.strip()
#         if m and re.match(r"^[\w.\-]+$", m):
#             out.append(m)
#     return out or [
#         "gemini-2.5-flash",
#         "gemini-2.0-flash",
#         "gemini-1.5-flash",
#         "gemini-1.5-pro",
#     ]


# def _safe_json(resp: requests.Response) -> Any | None:
#     try:
#         return resp.json()
#     except (json.JSONDecodeError, ValueError) as exc:
#         logger.warning("Invalid JSON from LLM HTTP response: %s", exc)
#         return None


# def _sanitize_llm_text(text: str) -> str:
#     """
#     Remove unwanted meta lines that some LLMs produce (e.g. "(You shared: ...)")
#     so the UI feels like a human conversation.
#     """
#     if not text:
#         return ""
#     t = text.replace("\r\n", "\n").strip()

#     # Remove any line containing "(You shared: ...)" entirely.
#     t = re.sub(
#         r"^\s*\(You shared:\s*.*?\)\s*$",
#         "",
#         t,
#         flags=re.IGNORECASE | re.MULTILINE,
#     )
#     # Remove any "(You shared: ...)" occurrence even if it spans lines.
#     t = re.sub(
#         r"\(You shared:\s*.*?\)",
#         "",
#         t,
#         flags=re.IGNORECASE | re.DOTALL,
#     )
#     # Remove "You shared:" lines (without parentheses) just in case.
#     t = re.sub(
#         r"^\s*You shared:\s*.*$",
#         "",
#         t,
#         flags=re.IGNORECASE | re.MULTILINE,
#     )

#     # Collapse extra blank lines.
#     t = re.sub(r"\n{3,}", "\n\n", t).strip()
#     return t


# def _build_chat_messages(
#     user_input: str, history: list[Any] | None, system_prompt: str
# ) -> list[dict[str, str]]:
#     """
#     Build an OpenRouter-compatible messages list with:
#     - system message
#     - up to last 5 history turns
#     - current user message
#     Each content is trimmed so overall text stays well under token limits.
#     """
#     msgs: list[dict[str, str]] = []
#     total_chars = 0
#     cap = LLM_MAX_CONTEXT_CHARS

#     def _add(role: str, content: str) -> None:
#         nonlocal total_chars
#         if not content:
#             return
#         if total_chars >= cap:
#             return
#         # Hard cap each segment and overall length.
#         allowed = cap - total_chars
#         snippet = content[: allowed]
#         if not snippet:
#             return
#         msgs.append({"role": role, "content": snippet})
#         total_chars += len(snippet)

#     _add("system", system_prompt)

#     if history:
#         # Keep only last 5 messages from history.
#         tail = history[-5:]
#         for item in tail:
#             role = "user"
#             text = ""
#             if hasattr(item, "sender") and hasattr(item, "content"):
#                 role = "user" if getattr(item, "sender") == "user" else "assistant"
#                 text = str(getattr(item, "content") or "")
#             elif isinstance(item, dict):
#                 role = "user" if (item.get("sender") or "user") == "user" else "assistant"
#                 text = str(item.get("content") or "")
#             _add(role, text)

#     _add("user", user_input)
#     return msgs


# def _call_gemini_one_model(
#     prompt: str,
#     model_id: str,
#     api_key: str,
#     max_output_tokens: int | None = None,
# ) -> str | None:
#     cap = max_output_tokens if max_output_tokens is not None else CHAT_MAX_TOKENS
#     # Gemini expects a "contents" list with role + parts.
#     payload: dict[str, Any] = {
#         "contents": [{"role": "user", "parts": [{"text": prompt}]}],
#         "generationConfig": {"maxOutputTokens": max(64, min(int(cap), 8192))},
#     }

#     for api_version in GEMINI_API_VERSIONS:
#         url = (
#             f"https://generativelanguage.googleapis.com/{api_version}/models/"
#             f"{model_id}:generateContent?key={api_key}"
#         )
#         try:
#             r = requests.post(
#                 url,
#                 json=payload,
#                 headers={"Content-Type": "application/json"},
#                 timeout=REQUEST_TIMEOUT,
#             )
#         except requests.Timeout as exc:
#             logger.warning("Gemini timeout (%s, %s): %s", model_id, api_version, exc)
#             print(f"[LLM] Gemini failure ({model_id}): timeout ({exc})")
#             continue
#         except requests.RequestException as exc:
#             logger.warning("Gemini request error (%s, %s): %s", model_id, api_version, exc)
#             print(f"[LLM] Gemini failure ({model_id}): request error ({exc})")
#             continue

#         if r.status_code >= 400:
#             logger.warning(
#                 "Gemini HTTP %s (%s, %s): %s",
#                 r.status_code,
#                 model_id,
#                 api_version,
#                 r.text[:500],
#             )
#             print(f"[LLM] Gemini failure ({model_id}): HTTP {r.status_code}")
#             continue

#         data = _safe_json(r)
#         if not isinstance(data, dict):
#             print(f"[LLM] Gemini failure ({model_id}): invalid JSON structure")
#             continue

#         try:
#             candidates = data.get("candidates") or []
#             if not candidates:
#                 fb = data.get("promptFeedback") or data.get("error")
#                 if fb:
#                     logger.warning(
#                         "Gemini no candidates (%s, %s): %s",
#                         model_id,
#                         api_version,
#                         fb,
#                     )
#                     print(f"[LLM] Gemini ({model_id}): no candidates — {fb}")
#                 else:
#                     print(f"[LLM] Gemini failure ({model_id}): no candidates in response")
#                 continue
#             parts = (candidates[0].get("content") or {}).get("parts") or []
#             if not parts:
#                 print(f"[LLM] Gemini failure ({model_id}): no content parts")
#                 continue
#             text = parts[0].get("text")
#         except (TypeError, KeyError, IndexError) as exc:
#             logger.warning("Gemini unexpected JSON shape (%s, %s): %s", model_id, api_version, exc)
#             print(f"[LLM] Gemini failure ({model_id}): unexpected JSON structure ({exc})")
#             continue

#         if isinstance(text, str) and text.strip():
#             print(f"[LLM] Gemini success with model: {model_id}")
#             return text.strip()

#     return None


# def _messages_to_gemini_prompt(messages: list[dict[str, str]]) -> str:
#     """Flatten chat messages into one Gemini user prompt."""
#     parts: list[str] = []
#     for m in messages:
#         role = (m.get("role") or "user").strip().lower()
#         content = (m.get("content") or "").strip()
#         if not content:
#             continue
#         if role == "system":
#             parts.append(f"Instructions:\n{content}")
#         elif role == "assistant":
#             parts.append(f"Assistant:\n{content}")
#         else:
#             parts.append(f"User:\n{content}")
#     return "\n\n".join(parts)[: LLM_MAX_CONTEXT_CHARS]


# def call_gemini(prompt: str, max_output_tokens: int | None = None) -> str | None:
#     """Call Google Gemini REST API; try each GEMINI_MODEL candidate until one works."""
#     api_key = gemini_api_key()
#     if not api_key:
#         msg = "GEMINI_API_KEY / GOOGLE_API_KEY not set"
#         logger.warning(msg)
#         print(f"[LLM] Gemini failure: {msg}")
#         return None

#     models = gemini_model_candidates()
#     print(f"[LLM] Gemini models to try: {', '.join(models)}")
#     for mid in models:
#         out = _call_gemini_one_model(prompt, mid, api_key, max_output_tokens)
#         if out:
#             return out
#     return None


# def call_groq_chat(
#     messages: list[dict[str, str]],
#     max_tokens: int | None = None,
# ) -> str | None:
#     """Groq OpenAI-compatible chat completions with full message history."""
#     key = groq_api_key()
#     if not key:
#         msg = "GROQ_API_KEY not set"
#         logger.warning(msg)
#         print(f"[LLM] Groq failure: {msg}")
#         return None
#     mt = int(max_tokens) if max_tokens is not None else CHAT_MAX_TOKENS
#     body = {
#         "model": GROQ_MODEL,
#         "messages": messages,
#         "max_tokens": max(32, min(mt, 8192)),
#         "temperature": float(os.environ.get("GROQ_TEMPERATURE", "0.45")),
#     }
#     headers = {
#         "Authorization": f"Bearer {key}",
#         "Content-Type": "application/json",
#     }
#     try:
#         r = requests.post(
#             GROQ_CHAT_URL,
#             json=body,
#             headers=headers,
#             timeout=REQUEST_TIMEOUT,
#         )
#     except requests.Timeout as exc:
#         logger.warning("Groq timeout: %s", exc)
#         print(f"[LLM] Groq failure: timeout ({exc})")
#         return None
#     except requests.RequestException as exc:
#         logger.warning("Groq request error: %s", exc)
#         print(f"[LLM] Groq failure: request error ({exc})")
#         return None

#     if r.status_code >= 400:
#         logger.warning("Groq HTTP %s: %s", r.status_code, r.text[:500])
#         print(f"[LLM] Groq failure: HTTP {r.status_code}")
#         return None

#     data = _safe_json(r)
#     if not isinstance(data, dict):
#         print("[LLM] Groq failure: invalid JSON structure")
#         return None

#     try:
#         choices = data.get("choices") or []
#         msg = (choices[0].get("message") or {}).get("content")
#     except (TypeError, KeyError, IndexError) as exc:
#         logger.warning("Groq unexpected JSON shape: %s", exc)
#         print(f"[LLM] Groq failure: unexpected JSON structure ({exc})")
#         return None

#     if isinstance(msg, str) and msg.strip():
#         return msg.strip()
#     return None


# def call_groq(prompt: str) -> str | None:
#     """Single user-message convenience wrapper."""
#     return call_groq_chat([{"role": "user", "content": prompt}])


# def call_openrouter_chat(
#     messages: list[dict[str, str]],
#     max_tokens: int | None = None,
# ) -> str | None:
#     """
#     OpenRouter chat completions (free-tier models) with multi-model fallback.
#     - messages: OpenAI-style chat messages, already trimmed.
#     - Tries each model in OPENROUTER_MODELS in order.
#     - max_tokens from CHAT_MAX_TOKENS (default 220; env CHAT_MAX_TOKENS or OPENROUTER_MAX_TOKENS).
#     """
#     key = openrouter_api_key()
#     if not key:
#         msg = "OPENROUTER_API_KEY not set"
#         logger.warning(msg)
#         print(f"[LLM] OpenRouter failure: {msg}")
#         return None
#     mt = int(max_tokens) if max_tokens is not None else OPENROUTER_MAX_TOKENS
#     headers = {
#         "Authorization": f"Bearer {key}",
#         "Content-Type": "application/json",
#         "HTTP-Referer": os.environ.get("OPENROUTER_REFERRER", "http://localhost:8000"),
#         "X-Title": "Emotion Chat",
#     }
#     for model_id in OPENROUTER_MODELS:
#         body = {
#             "model": model_id,
#             "messages": messages,
#             "max_tokens": max(32, min(mt, 8192)),
#             "temperature": float(os.environ.get("OPENROUTER_TEMPERATURE", "0.45")),
#         }
#         try:
#             r = requests.post(
#                 OPENROUTER_CHAT_URL,
#                 json=body,
#                 headers=headers,
#                 timeout=REQUEST_TIMEOUT,
#             )
#         except requests.Timeout as exc:
#             logger.warning("OpenRouter timeout (%s): %s", model_id, exc)
#             print(f"[LLM] OpenRouter failure ({model_id}): timeout ({exc})")
#             continue
#         except requests.RequestException as exc:
#             logger.warning("OpenRouter request error (%s): %s", model_id, exc)
#             print(f"[LLM] OpenRouter failure ({model_id}): request error ({exc})")
#             continue

#         if r.status_code >= 400:
#             logger.warning(
#                 "OpenRouter HTTP %s (%s): %s",
#                 r.status_code,
#                 model_id,
#                 r.text[:500],
#             )
#             print(f"[LLM] OpenRouter failure ({model_id}): HTTP {r.status_code}")
#             continue

#         data = _safe_json(r)
#         if not isinstance(data, dict):
#             print(f"[LLM] OpenRouter failure ({model_id}): invalid JSON structure")
#             continue

#         try:
#             choices = data.get("choices") or []
#             msg_out = (choices[0].get("message") or {}).get("content")
#         except (TypeError, KeyError, IndexError) as exc:
#             logger.warning("OpenRouter unexpected JSON shape (%s): %s", model_id, exc)
#             print(f"[LLM] OpenRouter failure ({model_id}): unexpected JSON structure ({exc})")
#             continue

#         if isinstance(msg_out, str) and msg_out.strip():
#             print(f"[LLM] OpenRouter success with model: {model_id}")
#             return msg_out.strip()

#     return None


# def complete_chat_messages(
#     messages: list[dict[str, str]],
#     max_tokens: int | None = None,
# ) -> str | None:
#     """
#     Run the same provider chain as chat (LLM_ORDER: Groq → OpenRouter → Gemini).
#     Use for journal / structured prompts. Returns None if every provider fails.
#     """
#     mt = int(max_tokens) if max_tokens is not None else CHAT_MAX_TOKENS
#     capped: list[dict[str, str]] = []
#     budget = LLM_MAX_CONTEXT_CHARS
#     used = 0
#     for m in messages:
#         role = m.get("role") or "user"
#         content = m.get("content") or ""
#         take = content[: max(0, budget - used)]
#         if not take.strip():
#             continue
#         capped.append({"role": role, "content": take})
#         used += len(take)
#     if not capped:
#         return None
#     gemini_prompt = _messages_to_gemini_prompt(capped)
#     order = LLM_ORDER or ["groq", "openrouter", "gemini"]
#     for provider in order:
#         if provider == "openrouter":
#             logger.info("Journal LLM: OpenRouter")
#             out = call_openrouter_chat(capped, max_tokens=mt)
#             if out:
#                 return out
#         elif provider == "gemini":
#             logger.info("Journal LLM: Gemini")
#             out = call_gemini(gemini_prompt, max_output_tokens=mt)
#             if out:
#                 return out
#         elif provider == "groq":
#             logger.info("Journal LLM: Groq")
#             out = call_groq_chat(capped, max_tokens=mt)
#             if out:
#                 return out
#         else:
#             logger.warning("LLM_ORDER unknown provider %r — skipped", provider)
#     return None


# def get_llm_response(
#     user_input: str,
#     primary_emotion: str | None = None,
#     history: list[Any] | None = None,
#     memory_context: str | None = None,
# ) -> str:
#     """
#     Build chat prompt; try providers in LLM_ORDER (default: Groq → OpenRouter → Gemini).
#     One call per provider where applicable (no duplicate Gemini retries).
#     """
#     text = (user_input or "").strip()
#     if not text:
#         return "Please send a non-empty message."

#     # Trim raw text defensively.
#     text = text[:6000]
#     system_prompt = build_chat_system_prompt(primary_emotion, memory_context)
#     final_prompt = system_prompt + "\n\nUser:\n" + text

#     try:
#         chat_messages = _build_chat_messages(text, history, system_prompt)
#     except Exception:
#         chat_messages = _build_chat_messages(text, None, system_prompt)

#     order = LLM_ORDER or ["groq", "openrouter", "gemini"]
#     for provider in order:
#         if provider == "openrouter":
#             logger.info("LLM pipeline: OpenRouter")
#             print("[LLM] Using API: OpenRouter")
#             out = call_openrouter_chat(chat_messages)
#             if out:
#                 return _sanitize_llm_text(out)
#         elif provider == "gemini":
#             logger.info("LLM pipeline: Gemini")
#             print("[LLM] Using API: Gemini")
#             out = call_gemini(final_prompt)
#             if out:
#                 return _sanitize_llm_text(out)
#         elif provider == "groq":
#             logger.info("LLM pipeline: Groq")
#             print("[LLM] Using API: Groq")
#             out = call_groq_chat(chat_messages)
#             if out:
#                 return _sanitize_llm_text(out)
#         else:
#             logger.warning("LLM_ORDER unknown provider %r — skipped", provider)

#     logger.error("LLM: all providers failed")
#     print("[LLM] All providers failed; returning emotion-aware graceful error message")
#     key = (primary_emotion or "").lower()
#     if key not in EMOTION_FALLBACK_MESSAGES:
#         key = "neutral"
#     return EMOTION_FALLBACK_MESSAGES[key]
"""
Bulletproof Multi-Provider LLM Service
Strategy:
  - Multiple API keys per provider (rotate on 429/expired)
  - All free models per provider (fallback within provider)
  - Smart error detection (rate limit vs expired vs quota)
  - Provider order: Gemini → Groq → OpenRouter (most reliable free first)
  - Never fails silently — always tries everything before giving up
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

from chat.empathy_prompts import build_chat_system_prompt

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVICE_ROOT / ".env")
load_dotenv()

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT = int(os.environ.get("LLM_HTTP_TIMEOUT", "15"))
LLM_MAX_CONTEXT_CHARS = int(os.environ.get("LLM_MAX_CONTEXT_CHARS", "10000"))
CHAT_MAX_TOKENS = int(os.environ.get("CHAT_MAX_TOKENS") or os.environ.get("OPENROUTER_MAX_TOKENS") or "180")
OPENROUTER_MAX_TOKENS = CHAT_MAX_TOKENS

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"

# ---------------------------------------------------------------------------
# ALL FREE MODELS — updated April 2026
# ---------------------------------------------------------------------------

# Gemini free models (fastest, most reliable free tier)
GEMINI_FREE_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
]

# Groq free models — all current production IDs
GROQ_FREE_MODELS = [
    "llama-3.3-70b-versatile",       # primary — best quality
    "llama-3.1-8b-instant",          # fastest
    "llama3-70b-8192",               # legacy but still available
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "gemma-7b-it",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview",
    "llama-guard-3-8b",
    "deepseek-r1-distill-llama-70b",
    "qwen-qwq-32b",
    "mistral-saba-24b",
    "allam-2-7b",
]

# OpenRouter free models — all :free tier endpoints
OPENROUTER_FREE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.1-70b-instruct:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "meta-llama/llama-3.2-1b-instruct:free",
    "qwen/qwen3-235b-a22b:free",
    "qwen/qwen3-30b-a3b:free",
    "qwen/qwen3-14b:free",
    "qwen/qwen3-8b:free",
    "qwen/qwen2.5-72b-instruct:free",
    "qwen/qwen2.5-7b-instruct:free",
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-2-9b-it:free",
    "mistralai/mistral-7b-instruct:free",
    "mistralai/mistral-small-24b-instruct-2501:free",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-v3:free",
    "deepseek/deepseek-chat:free",
    "microsoft/phi-3-mini-128k-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "openchat/openchat-7b:free",
    "huggingfaceh4/zephyr-7b-beta:free",
    "nousresearch/nous-capybara-7b:free",
    "gryphe/mythomist-7b:free",
    "undi95/toppy-m-7b:free",
]

GEMINI_API_VERSIONS = ["v1beta", "v1"]

EMOTION_FALLBACK_MESSAGES: dict[str, str] = {
    "happy": (
        "💛✨ I'm so happy you shared that — I'm getting a small technical hiccup on my side, "
        "but I'm right here cheering you on and soaking up your good energy. 🌟🤗"
    ),
    "sad": (
        "🫂 I'm really sorry things feel heavy right now. I hit a brief snag replying, "
        "but you're not alone in this moment — I'm with you. 🌙"
    ),
    "anxious": (
        "🌿🫧 I can tell it's a lot right now. I had a tiny delay on my end—want to take one slow breath "
        "together while I catch up? I've got you. 🌊✨"
    ),
    "angry": (
        "🕊️💬 I hear your frustration, and it makes sense. I'm sorry a technical delay piled on—I'm "
        "working to get back so we can talk it through properly. 🙏🌱"
    ),
    "neutral": (
        "💬 I'm here and I'm listening. Connection flickered for a second, but what you said still "
        "matters to me—thanks for your patience. ✨"
    ),
}


# ---------------------------------------------------------------------------
# KEY ROTATION — load multiple keys per provider from .env
# ---------------------------------------------------------------------------
# In your .env, add keys like:
#   GEMINI_API_KEY=key1
#   GEMINI_API_KEY_2=key2
#   GEMINI_API_KEY_3=key3
#
#   GROQ_API_KEY=key1
#   GROQ_API_KEY_2=key2
#   GROQ_API_KEY_3=key3
#
#   OPENROUTER_API_KEY=key1
#   OPENROUTER_API_KEY_2=key2
#   OPENROUTER_API_KEY_3=key3
# ---------------------------------------------------------------------------

def _strip_env(val: str | None) -> str:
    if not val:
        return ""
    return val.strip().strip("'").strip('"')


def _load_keys(base_env: str, alt_envs: list[str]) -> list[str]:
    """Load all non-empty keys for a provider."""
    keys = []
    for env in [base_env] + alt_envs:
        k = _strip_env(os.environ.get(env))
        if k and "..." not in k and k not in keys:
            keys.append(k)
    return keys


def gemini_keys() -> list[str]:
    return _load_keys(
        "GEMINI_API_KEY",
        ["GOOGLE_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4", "GEMINI_API_KEY_5"],
    )


def groq_keys() -> list[str]:
    return _load_keys(
        "GROQ_API_KEY",
        ["GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GROQ_API_KEY_5"],
    )


def openrouter_keys() -> list[str]:
    return _load_keys(
        "OPENROUTER_API_KEY",
        ["OPENROUTER_API_KEY_2", "OPENROUTER_API_KEY_3", "OPENROUTER_API_KEY_4", "OPENROUTER_API_KEY_5"],
    )


# ---------------------------------------------------------------------------
# ERROR CLASSIFICATION
# ---------------------------------------------------------------------------

class _ErrorKind:
    RATE_LIMIT   = "rate_limit"    # 429 — rotate key, try next model
    EXPIRED      = "expired"       # expired key — skip this key entirely
    QUOTA        = "quota"         # daily/monthly quota exhausted — skip key
    BAD_MODEL    = "bad_model"     # model not found / no endpoints — skip model
    BAD_REQUEST  = "bad_request"   # malformed request — retry with merged prompt
    SERVER_ERROR = "server_error"  # 5xx — retry once, then move on
    UNKNOWN      = "unknown"


def _classify_error(status: int, body: str) -> str:
    low = body.lower()
    if status == 429:
        if any(x in low for x in ["rate limit", "rate_limit", "quota", "tpd", "tokens per day", "requests per day"]):
            return _ErrorKind.RATE_LIMIT
        return _ErrorKind.RATE_LIMIT
    if status == 400:
        if "expired" in low or "api_key_invalid" in low:
            return _ErrorKind.EXPIRED
        if "developer instruction" in low or "system" in low:
            return _ErrorKind.BAD_REQUEST
        if "no endpoints" in low or "not found" in low:
            return _ErrorKind.BAD_MODEL
        return _ErrorKind.BAD_REQUEST
    if status == 404:
        return _ErrorKind.BAD_MODEL
    if status == 401 or status == 403:
        return _ErrorKind.EXPIRED
    if status >= 500:
        return _ErrorKind.SERVER_ERROR
    return _ErrorKind.UNKNOWN


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _safe_json(resp: requests.Response) -> Any | None:
    try:
        return resp.json()
    except (json.JSONDecodeError, ValueError):
        return None


def _sanitize_llm_text(text: str) -> str:
    if not text:
        return ""
    t = text.replace("\r\n", "\n").strip()
    t = re.sub(r"^\s*\(You shared:\s*.*?\)\s*$", "", t, flags=re.IGNORECASE | re.MULTILINE)
    t = re.sub(r"\(You shared:\s*.*?\)", "", t, flags=re.IGNORECASE | re.DOTALL)
    t = re.sub(r"^\s*You shared:\s*.*$", "", t, flags=re.IGNORECASE | re.MULTILINE)
    t = re.sub(r"\n{3,}", "\n\n", t).strip()
    return t


def _build_chat_messages(
    user_input: str, history: list[Any] | None, system_prompt: str
) -> list[dict[str, str]]:
    msgs: list[dict[str, str]] = []
    total_chars = 0
    cap = LLM_MAX_CONTEXT_CHARS

    def _add(role: str, content: str) -> None:
        nonlocal total_chars
        if not content or total_chars >= cap:
            return
        snippet = content[: cap - total_chars]
        if not snippet:
            return
        msgs.append({"role": role, "content": snippet})
        total_chars += len(snippet)

    _add("system", system_prompt)
    if history:
        for item in history[-5:]:
            role, text = "user", ""
            if hasattr(item, "sender") and hasattr(item, "content"):
                role = "user" if getattr(item, "sender") == "user" else "assistant"
                text = str(getattr(item, "content") or "")
            elif isinstance(item, dict):
                role = "user" if (item.get("sender") or "user") == "user" else "assistant"
                text = str(item.get("content") or "")
            _add(role, text)
    _add("user", user_input)
    return msgs


def _messages_to_gemini_prompt(messages: list[dict[str, str]]) -> str:
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
    return "\n\n".join(parts)[:LLM_MAX_CONTEXT_CHARS]


def _merge_system_into_user(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """Merge system prompt into first user message for providers that don't support system role."""
    if not messages or (messages[0].get("role") or "").lower() != "system":
        return messages
    sys_text = (messages[0].get("content") or "").strip()
    rest = messages[1:]
    out: list[dict[str, str]] = []
    merged = False
    for m in rest:
        role = (m.get("role") or "user").lower()
        content = m.get("content") or ""
        if not merged and role == "user":
            out.append({"role": "user", "content": f"{sys_text}\n\n---\n\n{content}"})
            merged = True
        else:
            out.append(dict(m))
    if not merged:
        out.insert(0, {"role": "user", "content": sys_text})
    return out


# ---------------------------------------------------------------------------
# GEMINI — key rotation + all models
# ---------------------------------------------------------------------------

def call_gemini(
    prompt: str,
    max_output_tokens: int | None = None,
) -> str | None:
    """Try every Gemini key × every free model until one succeeds."""
    keys = gemini_keys()
    if not keys:
        logger.warning("No Gemini API keys configured")
        return None

    cap = max_output_tokens or CHAT_MAX_TOKENS
    payload: dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max(64, min(int(cap), 8192))},
    }

    for key_idx, api_key in enumerate(keys):
        key_exhausted = False
        for model_id in GEMINI_FREE_MODELS:
            if key_exhausted:
                break
            for api_version in GEMINI_API_VERSIONS:
                url = (
                    f"https://generativelanguage.googleapis.com/{api_version}/models/"
                    f"{model_id}:generateContent?key={api_key}"
                )
                try:
                    r = requests.post(
                        url, json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=REQUEST_TIMEOUT,
                    )
                except requests.Timeout:
                    logger.warning("Gemini timeout (%s)", model_id)
                    continue
                except requests.RequestException as exc:
                    logger.warning("Gemini request error (%s): %s", model_id, exc)
                    continue

                if r.status_code >= 400:
                    kind = _classify_error(r.status_code, r.text)
                    logger.warning("Gemini HTTP %s (%s, key#%d): %s → %s",
                                   r.status_code, model_id, key_idx + 1, r.text[:200], kind)
                    print(f"[LLM] Gemini key#{key_idx+1} {model_id}: HTTP {r.status_code} [{kind}]")
                    if kind in (_ErrorKind.EXPIRED, _ErrorKind.QUOTA):
                        key_exhausted = True  # skip remaining models for this key
                        break
                    if kind == _ErrorKind.RATE_LIMIT:
                        time.sleep(1)  # brief pause before next model
                        break  # try next model with same key
                    continue  # other errors — try next api_version

                data = _safe_json(r)
                if not isinstance(data, dict):
                    continue

                try:
                    candidates = data.get("candidates") or []
                    if not candidates:
                        continue
                    parts = (candidates[0].get("content") or {}).get("parts") or []
                    text = parts[0].get("text") if parts else None
                except (TypeError, KeyError, IndexError):
                    continue

                if isinstance(text, str) and text.strip():
                    print(f"[LLM] Gemini ✓ key#{key_idx+1} model={model_id}")
                    return text.strip()

                break  # got response but no text — try next model

    return None


# ---------------------------------------------------------------------------
# GROQ — key rotation + all models
# ---------------------------------------------------------------------------

def call_groq_chat(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """Try every Groq key × every free model until one succeeds."""
    keys = groq_keys()
    if not keys:
        logger.warning("No Groq API keys configured")
        return None

    mt = max(32, min(int(max_tokens or CHAT_MAX_TOKENS), 8192))
    headers_base = {"Content-Type": "application/json"}

    for key_idx, api_key in enumerate(keys):
        key_exhausted = False
        for model_id in GROQ_FREE_MODELS:
            if key_exhausted:
                break
            body = {
                "model": model_id,
                "messages": messages,
                "max_tokens": mt,
                "temperature": float(os.environ.get("GROQ_TEMPERATURE", "0.45")),
            }
            headers = {**headers_base, "Authorization": f"Bearer {api_key}"}
            try:
                r = requests.post(GROQ_CHAT_URL, json=body, headers=headers, timeout=REQUEST_TIMEOUT)
            except requests.Timeout:
                logger.warning("Groq timeout (%s)", model_id)
                continue
            except requests.RequestException as exc:
                logger.warning("Groq request error (%s): %s", model_id, exc)
                continue

            if r.status_code >= 400:
                kind = _classify_error(r.status_code, r.text)
                logger.warning("Groq HTTP %s (%s, key#%d): %s → %s",
                               r.status_code, model_id, key_idx + 1, r.text[:200], kind)
                print(f"[LLM] Groq key#{key_idx+1} {model_id}: HTTP {r.status_code} [{kind}]")
                if kind in (_ErrorKind.EXPIRED, _ErrorKind.QUOTA):
                    key_exhausted = True
                    break
                if kind == _ErrorKind.RATE_LIMIT:
                    time.sleep(0.5)
                continue

            data = _safe_json(r)
            if not isinstance(data, dict):
                continue

            try:
                choices = data.get("choices") or []
                msg = (choices[0].get("message") or {}).get("content")
            except (TypeError, KeyError, IndexError):
                continue

            if isinstance(msg, str) and msg.strip():
                print(f"[LLM] Groq ✓ key#{key_idx+1} model={model_id}")
                return msg.strip()

    return None


def call_groq(prompt: str) -> str | None:
    return call_groq_chat([{"role": "user", "content": prompt}])


# ---------------------------------------------------------------------------
# OPENROUTER — key rotation + all models + system-merge fallback
# ---------------------------------------------------------------------------

def call_openrouter_chat(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """Try every OpenRouter key × every free model (with system-merge retry)."""
    keys = openrouter_keys()
    if not keys:
        logger.warning("No OpenRouter API keys configured")
        return None

    mt = max(32, min(int(max_tokens or OPENROUTER_MAX_TOKENS), 8192))
    merged_messages = _merge_system_into_user(messages)
    has_merged = merged_messages != messages

    for key_idx, api_key in enumerate(keys):
        key_exhausted = False
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": os.environ.get("OPENROUTER_REFERRER", "http://localhost:8000"),
            "X-Title": "Emotion Chat",
        }
        for model_id in OPENROUTER_FREE_MODELS:
            if key_exhausted:
                break

            # Try normal messages first, then merged if provider rejects system role
            attempts = [messages]
            if has_merged:
                attempts.append(merged_messages)

            success = False
            for attempt_msgs in attempts:
                body = {
                    "model": model_id,
                    "messages": attempt_msgs,
                    "max_tokens": mt,
                    "temperature": float(os.environ.get("OPENROUTER_TEMPERATURE", "0.45")),
                }
                try:
                    r = requests.post(OPENROUTER_CHAT_URL, json=body, headers=headers, timeout=REQUEST_TIMEOUT)
                except requests.Timeout:
                    logger.warning("OpenRouter timeout (%s)", model_id)
                    break
                except requests.RequestException as exc:
                    logger.warning("OpenRouter request error (%s): %s", model_id, exc)
                    break

                if r.status_code >= 400:
                    kind = _classify_error(r.status_code, r.text)
                    logger.warning("OpenRouter HTTP %s (%s, key#%d): %s → %s",
                                   r.status_code, model_id, key_idx + 1, r.text[:200], kind)
                    print(f"[LLM] OpenRouter key#{key_idx+1} {model_id}: HTTP {r.status_code} [{kind}]")
                    if kind in (_ErrorKind.EXPIRED, _ErrorKind.QUOTA):
                        key_exhausted = True
                        break
                    if kind == _ErrorKind.BAD_MODEL:
                        break  # skip to next model entirely
                    if kind == _ErrorKind.BAD_REQUEST and has_merged:
                        continue  # retry with merged messages
                    if kind == _ErrorKind.RATE_LIMIT:
                        time.sleep(0.5)
                        break
                    continue

                data = _safe_json(r)
                if not isinstance(data, dict):
                    continue

                try:
                    choices = data.get("choices") or []
                    msg_out = (choices[0].get("message") or {}).get("content")
                except (TypeError, KeyError, IndexError):
                    continue

                if isinstance(msg_out, str) and msg_out.strip():
                    print(f"[LLM] OpenRouter ✓ key#{key_idx+1} model={model_id}")
                    return msg_out.strip()

                break  # got response but no text — next model

            if success:
                break

    return None


# ---------------------------------------------------------------------------
# PROVIDER ORDER — configurable via LLM_ORDER env var
# ---------------------------------------------------------------------------
# Default: gemini first (most generous free quota), then groq (fastest),
# then openrouter (most models). Change in .env:
#   LLM_ORDER=gemini,groq,openrouter
# ---------------------------------------------------------------------------

_LLM_ORDER_RAW = os.environ.get("LLM_ORDER", "gemini,groq,openrouter")
LLM_ORDER = [p.strip().lower() for p in _LLM_ORDER_RAW.split(",") if p.strip()]


def _run_provider(
    provider: str,
    chat_messages: list[dict[str, str]],
    gemini_prompt: str,
    max_tokens: int | None = None,
) -> str | None:
    mt = max_tokens or CHAT_MAX_TOKENS
    if provider == "gemini":
        logger.info("LLM pipeline: Gemini")
        print("[LLM] Using API: Gemini")
        return call_gemini(gemini_prompt, max_output_tokens=mt)
    elif provider == "groq":
        logger.info("LLM pipeline: Groq")
        print("[LLM] Using API: Groq")
        return call_groq_chat(chat_messages, max_tokens=mt)
    elif provider == "openrouter":
        logger.info("LLM pipeline: OpenRouter")
        print("[LLM] Using API: OpenRouter")
        return call_openrouter_chat(chat_messages, max_tokens=mt)
    else:
        logger.warning("Unknown provider %r — skipped", provider)
        return None


# ---------------------------------------------------------------------------
# PUBLIC ENTRY POINTS
# ---------------------------------------------------------------------------

def get_llm_response(
    user_input: str,
    primary_emotion: str | None = None,
    history: list[Any] | None = None,
    memory_context: str | None = None,
) -> str:
    """
    Main chat function. Tries all providers × all keys × all models.
    Will only return the fallback message if literally every option is exhausted.
    """
    text = (user_input or "").strip()[:6000]
    if not text:
        return "Please send a non-empty message."

    system_prompt = build_chat_system_prompt(primary_emotion, memory_context)
    final_prompt = system_prompt + "\n\nUser:\n" + text

    try:
        chat_messages = _build_chat_messages(text, history, system_prompt)
    except Exception:
        chat_messages = _build_chat_messages(text, None, system_prompt)

    gemini_prompt = _messages_to_gemini_prompt(chat_messages)
    order = LLM_ORDER or ["gemini", "groq", "openrouter"]

    for provider in order:
        out = _run_provider(provider, chat_messages, gemini_prompt)
        if out:
            return _sanitize_llm_text(out)

    # Last resort: retry providers in reverse order with fresh attempt
    print("[LLM] Primary order exhausted — retrying in reverse order")
    for provider in reversed(order):
        out = _run_provider(provider, chat_messages, gemini_prompt)
        if out:
            return _sanitize_llm_text(out)

    logger.error("LLM: ALL providers, ALL keys, ALL models failed.")
    print("[LLM] All providers failed; returning emotion-aware graceful error message")
    key = (primary_emotion or "").lower()
    if key not in EMOTION_FALLBACK_MESSAGES:
        key = "neutral"
    return EMOTION_FALLBACK_MESSAGES[key]


def complete_chat_messages(
    messages: list[dict[str, str]],
    max_tokens: int | None = None,
) -> str | None:
    """
    For journal / structured prompts. Same provider chain as get_llm_response.
    """
    mt = int(max_tokens or CHAT_MAX_TOKENS)
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
    order = LLM_ORDER or ["gemini", "groq", "openrouter"]

    for provider in order:
        out = _run_provider(provider, capped, gemini_prompt, max_tokens=mt)
        if out:
            return out

    return None