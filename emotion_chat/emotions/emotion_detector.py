"""
Emotion detection: 768-d embeddings (all-mpnet-base-v2) + heuristic / classifier scores.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

EMOTIONS = ("happy", "sad", "anxious", "angry", "neutral")

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
    if re.search(r"\b(sad|depressed|cry|lonely|hurt|empty|down)\b", t):
        scores["sad"] = 0.55
    # Anxious / stressed.
    if re.search(r"\b(anxious|worried|stress|stressed|nervous|panic|overwhelmed?)\b", t):
        scores["anxious"] = 0.55
    # Angry / frustrated.
    if re.search(r"\b(angry|furious|hate|mad|irritated?|annoyed?)\b", t) or "frustrat" in t:
        scores["angry"] = 0.55
    if max(scores.values()) <= 0.2:
        scores["neutral"] = 0.5
    s = sum(scores.values())
    return {k: float(v / s) for k, v in scores.items()}


class EmotionDetector:
    """Embedding + classifier pipeline; use `emotion_detector` singleton from app code."""

    def detect_emotion(self, text: str) -> dict[str, Any]:
        """
        Returns primary_emotion, emotion_scores (dict), emotion_vector (list[float]), confidence.
        """
        text = (text or "").strip()
        if not text:
            vec = [0.0] * 768
            scores = {e: 0.2 for e in EMOTIONS}
            scores["neutral"] = 1.0
            return {
                "primary_emotion": "neutral",
                "emotion_scores": scores,
                "emotion_vector": vec,
                "confidence": 0.5,
            }

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
            primary = max(emotion_scores, key=emotion_scores.get)
            confidence = float(max(emotion_scores.values()))
        except Exception as e:
            logger.warning("Classifier fallback: %s", e)
            emotion_scores = _keyword_scores(text)
            primary = max(emotion_scores, key=emotion_scores.get)
            confidence = float(emotion_scores[primary])

        try:
            emb = _get_embedder().encode(text, normalize_embeddings=True)
            arr = np.asarray(emb, dtype=np.float32).ravel()
            if arr.shape[0] != 768:
                raise ValueError(f"expected 768-d embedding, got {arr.shape[0]}")
            emotion_vector = arr.tolist()
        except Exception as e:
            logger.warning("Embedding fallback: %s", e)
            emotion_vector = [0.0] * 768

        return {
            "primary_emotion": primary,
            "emotion_scores": emotion_scores,
            "emotion_vector": emotion_vector,
            "confidence": confidence,
        }


emotion_detector = EmotionDetector()


def analyze_text(text: str) -> dict[str, Any]:
    """Backward-compatible entry point using the shared detector instance."""
    return emotion_detector.detect_emotion(text)
