"""
Emotion detection: 768-d embeddings (all-mpnet-base-v2) + heuristic / classifier scores.
Chat latency: optional fast keyword path skips transformer + embedder; embeddings off by default for chat.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

EMOTIONS = ("happy", "sad", "anxious", "angry", "neutral")

# Speed: if keyword scores already show a clear winner, skip DistilRoBERTa + (optional) embedding.
_EMOTION_FAST_KW = float(os.environ.get("EMOTION_FAST_KEYWORD_THRESHOLD", "0.37"))
# Default off — adds a full Gemini round-trip. Heuristic refine still fixes happy+frustration.
_EMOTION_LLM_REFINE = os.environ.get("EMOTION_LLM_REFINE", "0").strip().lower() in ("1", "true", "yes")
# Default off for chat — saves ~100–400ms per message; enable if you need vectors for search/RAG.
_EMOTION_COMPUTE_EMBEDDING = os.environ.get("EMOTION_COMPUTE_EMBEDDING", "0").strip().lower() in (
    "1",
    "true",
    "yes",
)

_embedder = None
_classifier = None


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer

        _embedder = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
    return _embedder


def _get_classifier():
    global _classifier
    if _classifier is None:
        from transformers import pipeline

        _classifier = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=None,
        )
    return _classifier


def _map_label_to_bucket(label: str) -> str:
    l = (label or "").lower()
    if any(x in l for x in ("joy", "love", "surprise")):
        return "happy"
    if "sad" in l or "grief" in l:
        return "sad"
    if "fear" in l or "nervous" in l:
        return "anxious"
    if "anger" in l or "disgust" in l:
        return "angry"
    return "neutral"


def _keyword_scores(text: str) -> dict[str, float]:
    t = text.lower()
    scores = {e: 0.2 for e in EMOTIONS}
    # Positive tone.
    if re.search(r"\b(happy|glad|great|love|thanks|awesome|grateful)\b", t):
        scores["happy"] = 0.55
    # Sad / low mood.
    if re.search(r"\b(sad|depressed|cry|lonely|hurt|empty|down|miserable|heartbroken)\b", t):
        scores["sad"] = 0.55
    # Anxious / stressed.
    if re.search(r"\b(anxious|worried|stress|stressed|nervous|panic|panicking|overwhelmed?)\b", t):
        scores["anxious"] = 0.55
    # Angry / frustrated (catch typos like "fryustrating" via partials).
    if re.search(
        r"\b(angry|furious|hate|mad|irritated?|annoyed?|upset|pissed|rage|raging|annoying|bad)\b",
        t,
    ) or "frustrat" in t or "fryustrat" in t:
        scores["angry"] = 0.65
    if max(scores.values()) <= 0.2:
        scores["neutral"] = 0.5
    s = sum(scores.values())
    return {k: float(v / s) for k, v in scores.items()}


def _heuristic_refine_primary(text: str, primary: str) -> str:
    """Fix obvious mislabels without an LLM (e.g. frustrated text tagged happy)."""
    t = (text or "").lower()
    negative_hint = any(
        kw in t
        for kw in (
            "frustrat",
            "fryustrat",
            "upset",
            "angry",
            "annoyed",
            "annoying",
            "irritat",
            "pissed",
            "hate",
            "bad",
            "terrible",
            "worst",
        )
    )
    if negative_hint and primary in ("happy", "neutral"):
        return "angry"
    return primary


def _llm_refine_primary_emotion(text: str, primary: str) -> str:
    """
    Ask an LLM to sanity-check the classifier's primary emotion, especially
    for frustrated / angry messages that may have been mislabeled as happy.

    Uses Gemini via the shared LLM service when configured; otherwise returns
    the original primary label.
    """
    cleaned = (text or "").strip()
    if not cleaned:
        return primary

    # Only bother refining when the classifier might be clearly wrong
    # (e.g. "happy" label on obviously negative language, or "neutral" on
    # strong emotion words). This keeps latency manageable.
    t = cleaned.lower()
    negative_hint = any(
        kw in t
        for kw in (
            "frustrat",
            "fryustrat",
            "upset",
            "angry",
            "annoyed",
            "annoying",
            "irritat",
            "pissed",
            "hate",
            "bad",
            "terrible",
            "worst",
        )
    )
    if not _EMOTION_LLM_REFINE:
        return primary
    if not negative_hint and primary not in ("neutral",):
        return primary

    try:
        # Import locally to avoid circular imports at module load time.
        from services.llm_service import call_gemini

        prompt = (
            "You are an expert emotion annotator. You label short chat messages.\n"
            "Allowed labels: happy, sad, anxious, angry, neutral.\n\n"
            f"User message:\n{cleaned[:600]}\n\n"
            f"Classifier prediction: {primary}.\n\n"
            "Correct the label if it is clearly wrong. If the message sounds frustrated, "
            "angry, upset, annoyed, or uses words like \"frustrating\" (including typos like "
            "\"fryustrating\"), you MUST choose \"angry\" even if the classifier said \"happy\".\n"
            "If the feeling is mixed, choose the dominant overall feeling.\n"
            "Respond with ONLY a single word label from this exact list: "
            "happy, sad, anxious, angry, neutral."
        )
        llm_out = call_gemini(prompt, max_output_tokens=64)
        if not isinstance(llm_out, str):
            return primary
        out = llm_out.strip().lower()
        for label in EMOTIONS:
            if label in out.split():
                if label != primary:
                    logger.info(
                        "Emotion LLM refinement: %s -> %s for text=%r",
                        primary,
                        label,
                        cleaned[:80],
                    )
                return label
        return primary
    except Exception as exc:
        logger.warning("LLM emotion refinement skipped: %s", exc)
        return primary


class EmotionDetector:
    """Embedding + classifier pipeline; use `emotion_detector` singleton from app code."""

    def detect_emotion(self, text: str) -> dict[str, Any]:
        """
        Returns primary_emotion, emotion_scores (dict), emotion_vector (list[float]), confidence.
        """
        text = (text or "").strip()
        if not text:
            scores = {e: 0.2 for e in EMOTIONS}
            scores["neutral"] = 1.0
            return {
                "primary_emotion": "neutral",
                "emotion_scores": scores,
                "emotion_vector": None,
                "confidence": 0.5,
            }

        kw_only = _keyword_scores(text)
        kw_best = max(kw_only, key=kw_only.get)
        kw_top = float(kw_only[kw_best])

        if kw_top >= _EMOTION_FAST_KW:
            emotion_scores = kw_only
            primary = _heuristic_refine_primary(text, kw_best)
            confidence = float(emotion_scores.get(primary, kw_top))
            if primary != kw_best:
                for e in EMOTIONS:
                    emotion_scores[e] *= 0.35
                emotion_scores[primary] = max(emotion_scores.get(primary, 0.0), 0.9)
                tot = sum(emotion_scores.values()) or 1.0
                emotion_scores = {k: float(v / tot) for k, v in emotion_scores.items()}
                confidence = float(emotion_scores[primary])
            llm_refined = _llm_refine_primary_emotion(text, primary) if _EMOTION_LLM_REFINE else primary
            if llm_refined in EMOTIONS and llm_refined != primary:
                primary = llm_refined
                for e in EMOTIONS:
                    emotion_scores[e] *= 0.4
                emotion_scores[primary] = max(emotion_scores.get(primary, 0.0), 0.9)
                tot = sum(emotion_scores.values()) or 1.0
                emotion_scores = {k: float(v / tot) for k, v in emotion_scores.items()}
                confidence = float(emotion_scores[primary])
        else:
            try:
                clf = _get_classifier()
                raw = clf(text[:512])
                if isinstance(raw, list) and raw and isinstance(raw[0], list):
                    raw = raw[0]
                label_scores: dict[str, float] = {}
                for item in raw:
                    lab = item.get("label", "")
                    sc = float(item.get("score", 0.0))
                    bucket = _map_label_to_bucket(lab)
                    label_scores[bucket] = max(label_scores.get(bucket, 0.0), sc)
                for e in EMOTIONS:
                    label_scores.setdefault(e, 0.05)
                total = sum(label_scores.values()) or 1.0
                emotion_scores = {k: float(v / total) for k, v in label_scores.items()}
                ml_primary = max(emotion_scores, key=emotion_scores.get)
                confidence = float(max(emotion_scores.values()))
            except Exception as e:
                logger.warning("Classifier fallback: %s", e)
                emotion_scores = _keyword_scores(text)
                ml_primary = max(emotion_scores, key=emotion_scores.get)
                confidence = float(emotion_scores[ml_primary])

            primary = _heuristic_refine_primary(text, ml_primary)
            if primary != ml_primary:
                for e in EMOTIONS:
                    emotion_scores[e] *= 0.35
                emotion_scores[primary] = max(emotion_scores.get(primary, 0.0), 0.9)
                tot = sum(emotion_scores.values()) or 1.0
                emotion_scores = {k: float(v / tot) for k, v in emotion_scores.items()}
                confidence = float(emotion_scores[primary])
            else:
                confidence = float(max(emotion_scores.values()))

            llm_refined = _llm_refine_primary_emotion(text, primary)
            if llm_refined in EMOTIONS and llm_refined != primary:
                primary = llm_refined
                for e in EMOTIONS:
                    emotion_scores[e] *= 0.4
                emotion_scores[primary] = max(emotion_scores.get(primary, 0.0), 0.9)
                total = sum(emotion_scores.values()) or 1.0
                emotion_scores = {k: float(v / total) for k, v in emotion_scores.items()}
                confidence = float(emotion_scores[primary])

        emotion_vector = None
        if _EMOTION_COMPUTE_EMBEDDING:
            try:
                emb = _get_embedder().encode(text, normalize_embeddings=True)
                arr = np.asarray(emb, dtype=np.float32).ravel()
                if arr.shape[0] != 768:
                    raise ValueError(f"expected 768-d embedding, got {arr.shape[0]}")
                emotion_vector = arr.tolist()
            except Exception as e:
                logger.warning("Embedding fallback: %s", e)
                emotion_vector = None

        return {
            "primary_emotion": primary,
            "emotion_scores": emotion_scores,
            "emotion_vector": emotion_vector,
            "confidence": confidence,
        }


emotion_detector = EmotionDetector()


def warmup_emotion_classifier() -> None:
    """
    Load DistilRoBERTa pipeline once (heavy on first use). Call from a background
    thread at process start so the first chat message is not blocked by model IO.
    """
    try:
        _get_classifier()
    except Exception as exc:
        logger.warning("Emotion classifier warmup failed: %s", exc)


def analyze_text(text: str) -> dict[str, Any]:
    """Backward-compatible entry point using the shared detector instance."""
    return emotion_detector.detect_emotion(text)
