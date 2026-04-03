"""
LangGraph pipeline: prepare prompt → invoke LLM → guarantee non-empty empathic reply.
Graph is compiled once per process for lower overhead on hot paths.
"""
from __future__ import annotations

import logging
from typing import TypedDict

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import END, START, StateGraph
except ImportError:  # pragma: no cover
    StateGraph = None  # type: ignore[misc, assignment]
    START = END = None  # type: ignore[misc, assignment]


class ChatGraphState(TypedDict, total=False):
    user_message: str
    primary_emotion: str
    relationship_stage: str
    history_block: str
    system_prompt: str
    reply: str
    gemini_key: str
    openai_key: str


def _compose(state: ChatGraphState) -> dict:
    from .empathy_prompts import build_system_prompt

    system_prompt = build_system_prompt(
        state.get("primary_emotion") or "neutral",
        state.get("relationship_stage") or "stranger",
        state.get("history_block") or "",
    )
    return {"system_prompt": system_prompt}


def _llm(state: ChatGraphState) -> dict:
    user_text = state.get("user_message") or ""
    system_prompt = state.get("system_prompt") or ""
    key_g = (state.get("gemini_key") or "").strip()
    key_o = (state.get("openai_key") or "").strip()

    if key_g:
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_google_genai import ChatGoogleGenerativeAI

            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=key_g,
                temperature=0.72,
                max_output_tokens=1024,
            )
            out = llm.invoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_text),
                ]
            )
            text = (out.content or "").strip()
            if text:
                return {"reply": text}
        except Exception as e:
            logger.warning("LangGraph Gemini node: %s", e)

    if key_o:
        try:
            from langchain_core.messages import HumanMessage, SystemMessage
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.72, max_tokens=1024)
            out = llm.invoke(
                [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_text),
                ]
            )
            text = (out.content or "").strip()
            if text:
                return {"reply": text}
        except Exception as e:
            logger.warning("LangGraph OpenAI node: %s", e)

    return {"reply": ""}


def _finalize(state: ChatGraphState) -> dict:
    from .empathy_prompts import fallback_reply_empathic

    existing = (state.get("reply") or "").strip()
    if existing:
        return {}
    return {
        "reply": fallback_reply_empathic(
            state.get("user_message") or "",
            state.get("primary_emotion") or "neutral",
            state.get("relationship_stage") or "stranger",
        )
    }


_compiled_graph = None


def get_empathy_graph():
    """Return a compiled graph (singleton). Falls back to None if LangGraph unavailable."""
    global _compiled_graph
    if StateGraph is None:
        return None
    if _compiled_graph is None:
        builder = StateGraph(ChatGraphState)
        builder.add_node("compose", _compose)
        builder.add_node("llm", _llm)
        builder.add_node("finalize", _finalize)
        builder.add_edge(START, "compose")
        builder.add_edge("compose", "llm")
        builder.add_edge("llm", "finalize")
        builder.add_edge("finalize", END)
        _compiled_graph = builder.compile()
    return _compiled_graph


def run_empathy_graph(
    user_message: str,
    primary_emotion: str,
    relationship_stage: str,
    history_block: str,
    gemini_key: str,
    openai_key: str,
) -> str:
    from .empathy_prompts import fallback_reply_empathic

    initial: ChatGraphState = {
        "user_message": user_message,
        "primary_emotion": primary_emotion,
        "relationship_stage": relationship_stage,
        "history_block": history_block,
        "gemini_key": gemini_key,
        "openai_key": openai_key,
    }

    graph = get_empathy_graph()
    if graph is None:
        state = dict(initial)
        state.update(_compose(state))
        state.update(_llm(state))
        state.update(_finalize(state))
        return (state.get("reply") or "").strip() or fallback_reply_empathic(
            user_message, primary_emotion, relationship_stage
        )

    out = graph.invoke(initial)
    return (out.get("reply") or "").strip() or fallback_reply_empathic(
        user_message, primary_emotion, relationship_stage
    )
