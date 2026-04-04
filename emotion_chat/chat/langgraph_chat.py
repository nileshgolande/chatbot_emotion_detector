"""
LangGraph orchestration for empathic chat replies.

The graph is intentionally small so you can extend it (e.g. retrieval, tool nodes,
router branches) without touching Django views. Generation still uses the existing
multi-provider stack in `services.llm_service`.
"""
from __future__ import annotations

import logging
import os
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

logger = logging.getLogger(__name__)

# Set to 0/false/no to call `get_llm_response` directly (bypass graph wiring).
_USE_GRAPH = os.environ.get("USE_LANGGRAPH_CHAT", "1").strip().lower() in (
    "1",
    "true",
    "yes",
)


class ChatGraphState(TypedDict, total=False):
    user_input: str
    primary_emotion: str | None
    history: list[Any]
    reply: str


def _node_prepare_context(state: ChatGraphState) -> dict[str, Any]:
    """Normalize emotion hint; optional place for RAG / memory loading later."""
    raw = state.get("primary_emotion")
    pe = None
    if raw is not None:
        s = str(raw).strip().lower()
        pe = s if s else None
    hist = state.get("history")
    if hist is None:
        hist = []
    return {"primary_emotion": pe, "history": hist}


def _node_generate(state: ChatGraphState) -> dict[str, Any]:
    from services.llm_service import get_llm_response

    text = (state.get("user_input") or "").strip()
    reply = get_llm_response(
        text,
        state.get("primary_emotion"),
        history=state.get("history"),
    )
    return {"reply": reply}


def _build_graph():
    workflow = StateGraph(ChatGraphState)
    workflow.add_node("prepare_context", _node_prepare_context)
    workflow.add_node("generate", _node_generate)
    workflow.add_edge(START, "prepare_context")
    workflow.add_edge("prepare_context", "generate")
    workflow.add_edge("generate", END)
    return workflow.compile()


_compiled = None


def _compiled_graph():
    global _compiled
    if _compiled is None:
        _compiled = _build_graph()
        logger.info("LangGraph chat pipeline compiled (prepare_context → generate)")
    return _compiled


def run_chat_graph(
    user_input: str,
    primary_emotion: str | None = None,
    history: list[Any] | None = None,
) -> str:
    """
    Run the compiled graph and return the assistant reply string.
    Falls back to `get_llm_response` if the graph is disabled via env.
    """
    from services.llm_service import get_llm_response

    text = (user_input or "").strip()
    hist = history if history is not None else []

    if not _USE_GRAPH:
        return get_llm_response(text, primary_emotion, history=hist)

    out = _compiled_graph().invoke(
        {
            "user_input": text,
            "primary_emotion": primary_emotion,
            "history": hist,
        }
    )
    reply = (out.get("reply") or "").strip()
    if reply:
        return reply
    logger.warning("LangGraph returned empty reply; using direct LLM fallback")
    return get_llm_response(text, primary_emotion, history=hist)
