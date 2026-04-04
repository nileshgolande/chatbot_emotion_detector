"""Build daily journal digest from chat emotion history + mood summaries."""
from __future__ import annotations

import json
import logging
import re
from datetime import date, timedelta
from typing import Any

from django.db.models import Count
from django.utils import timezone

from emotions.models import DailyMoodSummary, EmotionAnalysis

logger = logging.getLogger(__name__)

EMOTION_ORDER = ("happy", "sad", "anxious", "angry", "neutral")

# Weights for 0–100 wellness (higher = better composite day)
_WELL_WEIGHTS = {
    "happy": 1.0,
    "neutral": 0.72,
    "sad": 0.38,
    "anxious": 0.42,
    "angry": 0.4,
}


def _safe_pct(counts: dict[str, int]) -> dict[str, float]:
    total = sum(counts.values())
    if total <= 0:
        return {e: 0.0 for e in EMOTION_ORDER}
    return {e: round(100.0 * counts.get(e, 0) / total, 1) for e in EMOTION_ORDER}


def _wellness_score(counts: dict[str, int]) -> int:
    total = sum(counts.values())
    if total <= 0:
        return 0
    wsum = sum(_WELL_WEIGHTS.get(e, 0.5) * counts.get(e, 0) for e in EMOTION_ORDER)
    return int(round(100 * wsum / total))


def _dominant(counts: dict[str, int]) -> str:
    if not counts or sum(counts.values()) == 0:
        return "neutral"
    return max(counts, key=lambda k: counts.get(k, 0))


def _day_emotion_counts(user, d: date) -> dict[str, int]:
    qs = EmotionAnalysis.objects.filter(user=user, created_at__date=d)
    rows = qs.values("primary_emotion").annotate(c=Count("id"))
    raw = {row["primary_emotion"]: row["c"] for row in rows}
    return {e: int(raw.get(e, 0)) for e in EMOTION_ORDER}


def _day_timeline(user, d: date) -> list[dict[str, Any]]:
    qs = (
        EmotionAnalysis.objects.filter(user=user, created_at__date=d)
        .select_related("message")
        .order_by("created_at")
    )
    out = []
    for ea in qs:
        msg = ea.message
        if not msg or msg.sender != "user":
            continue
        local = timezone.localtime(ea.created_at)
        tstr = local.strftime("%I:%M %p").lstrip("0").replace(" 0", " ", 1)
        out.append(
            {
                "time": tstr,
                "content": (msg.content or "")[:400],
                "emotion": ea.primary_emotion,
            }
        )
    return out


def _activity_streak_ending(user, end: date, max_days: int = 120) -> int:
    streak = 0
    d = end
    for _ in range(max_days):
        n = EmotionAnalysis.objects.filter(user=user, created_at__date=d).count()
        if n == 0:
            if DailyMoodSummary.objects.filter(user=user, date=d, messages_count__gt=0).exists():
                streak += 1
                d -= timedelta(days=1)
                continue
            break
        streak += 1
        d -= timedelta(days=1)
    return streak


def _streak_calendar(user, end_anchor: date, days: int = 30) -> list[dict[str, Any]]:
    """One cell per day: dominant mood for heatmap."""
    out = []
    for i in range(days - 1, -1, -1):
        d = end_anchor - timedelta(days=i)
        summary = DailyMoodSummary.objects.filter(user=user, date=d).first()
        if summary and summary.emotion_distribution:
            dist = summary.emotion_distribution
            dom = max(dist, key=lambda k: dist[k]) if dist else summary.dominant_emotion
        else:
            counts = _day_emotion_counts(user, d)
            dom = _dominant(counts) if sum(counts.values()) else "neutral"
        out.append({"date": d.isoformat(), "dominant_emotion": dom})
    return out


def _heuristic_insights(
    user,
    anchor: date,
    timeline_today: list[dict],
    counts_today: dict[str, int],
) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    week_start = anchor - timedelta(days=7)

    week_qs = EmotionAnalysis.objects.filter(
        user=user,
        created_at__date__gte=week_start,
        created_at__date__lte=anchor,
    ).select_related("message")

    # Morning anxiety (before noon local)
    morning_anx = 0
    morning_days: set[date] = set()
    happy_evening_days: set[date] = set()
    for ea in week_qs:
        if not ea.message or ea.message.sender != "user":
            continue
        lt = timezone.localtime(ea.created_at)
        h = lt.hour
        d0 = lt.date()
        if ea.primary_emotion == "anxious" and h < 12:
            morning_anx += 1
            morning_days.add(d0)
        if ea.primary_emotion == "happy" and h >= 18:
            happy_evening_days.add(d0)

    if len(morning_days) >= 3:
        cards.append(
            {
                "icon": "🌅",
                "title": "Mornings may need a gentler start",
                "body": (
                    f"Anxiety showed up in your earlier messages on {len(morning_days)} "
                    "recent days. Try one slow breath or a short walk before opening messages "
                    "tomorrow; small rituals often help."
                ),
                "tone": "orange",
            }
        )

    if len(happy_evening_days) >= 4:
        cards.append(
            {
                "icon": "🌱",
                "title": "Your evenings look like recovery time",
                "body": (
                    f"On {len(happy_evening_days)} of the last week, your brighter moments "
                    "clustered after 6pm. Protect that window for rest or things that lift you."
                ),
                "tone": "green",
            }
        )

    # Same-day emotional shift (simple resilience signal)
    by_time = sorted(
        [
            (timezone.localtime(ea.created_at), ea.primary_emotion)
            for ea in EmotionAnalysis.objects.filter(user=user, created_at__date=anchor).select_related(
                "message"
            )
            if ea.message and ea.message.sender == "user"
        ],
        key=lambda x: x[0],
    )
    anger_idx = next((i for i, (_, em) in enumerate(by_time) if em == "angry"), None)
    if anger_idx is not None and anger_idx + 1 < len(by_time):
        later = [em for _, em in by_time[anger_idx + 1 :]]
        if "neutral" in later or "happy" in later:
            cards.append(
                {
                    "icon": "✨",
                    "title": "You bounced back today",
                    "body": (
                        "Strong feelings showed up, but you did not stay stuck in them. "
                        "Noticing that shift is part of emotional strength."
                    ),
                    "tone": "purple",
                }
            )

    if not cards and sum(counts_today.values()) > 0:
        dom = _dominant(counts_today)
        cards.append(
            {
                "icon": "💬",
                "title": f"Mostly {dom.capitalize()} energy today",
                "body": (
                    "Keep checking in with yourself; the patterns in your chats will get clearer "
                    "as you show up on more days."
                ),
                "tone": "purple",
            }
        )

    if sum(counts_today.values()) == 0:
        cards.append(
            {
                "icon": "📝",
                "title": "A quiet day in the log",
                "body": (
                    "No mood-tagged chat messages for this day yet. When you write in chat, "
                    "we will reflect the story here."
                ),
                "tone": "slate",
            }
        )

    return cards[:4]


def _fallback_story(
    dominant: str,
    counts: dict[str, int],
    timeline: list[dict],
    n_msg: int,
) -> dict[str, Any]:
    labels = {
        "happy": ("Mostly bright — your day had real warmth.", "😄 Mostly happy"),
        "neutral": ("A calm and steady day — you kept your balance.", "😐 Mostly neutral"),
        "sad": ("A heavier day — and you still showed up.", "😢 Mostly sad"),
        "anxious": ("A day when worry visited often.", "😰 Mostly anxious"),
        "angry": ("Strong frustration threaded through today.", "😠 Mostly frustrated"),
    }
    headline, badge_label = labels.get(dominant, labels["neutral"])
    p1 = (
        f"From your {n_msg} reflected message{'s' if n_msg != 1 else ''}, the overall tone skews "
        f'toward "{dominant}." That does not define you; it is a snapshot of this day.'
    )
    if timeline:
        full0 = timeline[0].get("content", "") or ""
        snippet = full0[:120]
        inner = snippet + ("..." if len(full0) >= 120 else "")
        p2 = f'Your day began around {timeline[0].get("time", "")} with: "{inner}"'
    else:
        p2 = "When you chat again, we will weave your moments into a richer story here."
    p3 = "Be gentle with yourself; you are allowed complex, shifting feelings."
    tags = []
    for e in EMOTION_ORDER:
        if counts.get(e, 0) > 0 and e != dominant:
            tags.append({"text": f"{e.capitalize()} moments", "emotion": e})
    if not tags:
        tags = [{"text": "Self-check-in", "emotion": "neutral"}]
    return {
        "headline": headline,
        "badge_label": badge_label,
        "dominant_emotion": dominant,
        "paragraphs": [p1, p2, p3],
        "tags": tags[:4],
        "quote": "Your emotions are valid. Every feeling you experience is worth listening to.",
        "write_prompt": "What is one thing you felt deeply today that you have not said out loud yet?",
    }


def build_daily_digest(user, target_date: date) -> dict[str, Any]:
    """Aggregate DB stats; narrative fields filled by enrich or _fallback_story."""
    today_counts = _day_emotion_counts(user, target_date)
    yesterday = target_date - timedelta(days=1)
    y_counts = _day_emotion_counts(user, yesterday)
    n_today = sum(today_counts.values())
    n_yesterday = sum(y_counts.values())
    timeline = _day_timeline(user, target_date)
    dominant = _dominant(today_counts)
    wellness = _wellness_score(today_counts)
    pct = _safe_pct(today_counts)
    streak = _activity_streak_ending(user, target_date)
    vs_y = n_today - n_yesterday

    story = _fallback_story(dominant, today_counts, timeline, n_today)
    insights = _heuristic_insights(user, target_date, timeline, today_counts)

    local_title = target_date.strftime("%A") + target_date.strftime(", %b ") + str(target_date.day) + target_date.strftime(" %Y")

    return {
        "date": target_date.isoformat(),
        "date_label": local_title,
        "quote": story["quote"],
        "write_prompt": story["write_prompt"],
        "dominant_emotion": dominant,
        "story": {
            "headline": story["headline"],
            "badge_label": story["badge_label"],
            "paragraphs": story["paragraphs"],
            "tags": story["tags"],
            "source_message_count": n_today,
        },
        "wellness_score": wellness,
        "messages_today": n_today,
        "day_streak": streak,
        "vs_yesterday_messages": vs_y,
        "emotion_pct": pct,
        "emotion_counts": today_counts,
        "timeline": timeline,
        "streak_30": _streak_calendar(user, target_date, 30),
        "insights": insights,
        "narrative_source": "heuristic",
    }


def apply_llm_story_patch(payload: dict[str, Any], raw_llm: str) -> dict[str, Any]:
    """Merge JSON story from LLM into payload; invalid JSON leaves payload unchanged."""
    text = (raw_llm or "").strip()
    if not text:
        return payload
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.I)
    text = re.sub(r"\s*```\s*$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        logger.warning("daily digest LLM returned non-JSON")
        return payload
    sto = payload.get("story") or {}
    if isinstance(data.get("headline"), str):
        sto["headline"] = data["headline"]
    if isinstance(data.get("badge_label"), str):
        sto["badge_label"] = data["badge_label"]
    if isinstance(data.get("paragraphs"), list):
        sto["paragraphs"] = [str(p) for p in data["paragraphs"] if str(p).strip()][:5]
    if isinstance(data.get("tags"), list):
        sto["tags"] = []
        for t in data["tags"][:6]:
            if isinstance(t, str):
                sto["tags"].append({"text": t, "emotion": payload.get("dominant_emotion", "neutral")})
            elif isinstance(t, dict) and t.get("text"):
                sto["tags"].append(
                    {"text": str(t["text"]), "emotion": str(t.get("emotion", "neutral"))}
                )
    if isinstance(data.get("quote"), str):
        payload["quote"] = data["quote"]
    if isinstance(data.get("write_prompt"), str):
        payload["write_prompt"] = data["write_prompt"]
    if isinstance(data.get("insights"), list):
        merged = []
        for item in data["insights"][:4]:
            if not isinstance(item, dict):
                continue
            merged.append(
                {
                    "icon": str(item.get("icon", "✨"))[:8],
                    "title": str(item.get("title", ""))[:200],
                    "body": str(item.get("body", ""))[:600],
                    "tone": str(item.get("tone", "purple"))[:24],
                }
            )
        if merged:
            payload["insights"] = merged
    payload["story"] = sto
    payload["narrative_source"] = "llm"
    return payload
