"""
Seed one power-user account with 10 conversations, rich chat history,
emotion analyses, daily mood summaries, journals, and journal insights.

Usage:
  python manage.py seed_demo_data

Re-run safe: clears prior seed-owned rows for the demo user, then recreates.
"""
from __future__ import annotations

import random
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone

from accounts.models import UserProfile
from chat.models import Conversation, Message, UserChatMemory
from emotions.models import DailyMoodSummary, EmotionAnalysis
from journal.models import JournalEntry, JournalInsights

DEMO_USERNAME = "demotester"
DEMO_EMAIL = "demotester@example.com"
DEMO_PASSWORD = "TestChat2026!Demo"


def _scores(primary: str, rng: random.Random) -> dict:
    base = {e: 0.04 for e in ("happy", "sad", "anxious", "angry", "neutral")}
    boost = 0.72
    base[primary] = boost
    rest = (1.0 - boost) / 4
    for k in base:
        if k != primary:
            base[k] = round(rest + rng.uniform(-0.02, 0.02), 3)
    s = sum(base.values())
    return {k: round(v / s, 3) for k, v in base.items()}


CHAT_SCENARIOS: list[dict] = [
    {
        "title": "Monday anxiety — new sprint",
        "stage": "acquaintance",
        "empathy": 0.62,
        "satisfaction": 0.71,
        "turns": [
            ("user", "I'm already stressed about the sprint planning meeting tomorrow.", "anxious"),
            ("bot", "That sounds like a lot on your mind. Want to unpack what's worrying you most—scope, people, or timeline?"),
            ("user", "Mostly timeline. My manager keeps adding \"small\" tasks.", "angry"),
            ("bot", "Small add-ons add up fast. One option: list everything in one place and ask which to defer—calm, factual."),
            ("user", "I'll try writing a one-page scope doc tonight.", "neutral"),
            ("bot", "Nice. Even a rough bullet list gives you something concrete to align on."),
        ],
    },
    {
        "title": "Celebrating a small win",
        "stage": "trusted",
        "empathy": 0.88,
        "satisfaction": 0.92,
        "turns": [
            ("user", "I finally shipped the bugfix that was haunting me for two weeks!", "happy"),
            ("bot", "Huge! That persistence paid off. How are you celebrating—even a tiny ritual counts."),
            ("user", "Ordered my favorite dessert and told my partner.", "happy"),
            ("bot", "Perfect. You earned that sweetness—literally and figuratively."),
        ],
    },
    {
        "title": "Feeling distant from friends",
        "stage": "stranger",
        "empathy": 0.75,
        "satisfaction": 0.58,
        "turns": [
            ("user", "Everyone's busy and I feel like I'm always the one reaching out.", "sad"),
            ("bot", "That imbalance can feel lonely. You're not wrong to notice it."),
            ("user", "Maybe I'm overthinking.", "anxious"),
            ("bot", "Maybe a bit of both. You could try one low-pressure check-in this week—no guilt if they’re slow to reply."),
        ],
    },
    {
        "title": "Interview prep stress",
        "stage": "acquaintance",
        "empathy": 0.7,
        "satisfaction": 0.65,
        "turns": [
            ("user", "System design interview in 4 days and my brain is mush.", "anxious"),
            ("bot", "Four days is enough for focused reps. Pick two patterns you’ll own end-to-end."),
            ("user", "Caching and rate limiting—I always freeze on tradeoffs.", "anxious"),
            ("bot", "Write three tradeoff bullets each: consistency vs latency, cost vs complexity. Say them out loud."),
        ],
    },
    {
        "title": "Argument with roommate",
        "stage": "close",
        "empathy": 0.82,
        "satisfaction": 0.6,
        "turns": [
            ("user", "We snapped at each other over dishes again. I'm furious.", "angry"),
            ("bot", "Recurring fights over small things often carry bigger subtext—respect, fairness, exhaustion."),
            ("user", "I'm tired of being the tidy one.", "angry"),
            ("bot", "Name that explicitly when you’re both calmer: “I need the split to feel fair.” Concrete schedule sometimes helps."),
            ("user", "I'll propose a chore chart tomorrow morning.", "neutral"),
            ("bot", "Good plan. Morning tends to be lower tension than late night."),
        ],
    },
    {
        "title": "Gratitude after a rough week",
        "stage": "trusted",
        "empathy": 0.85,
        "satisfaction": 0.9,
        "turns": [
            ("user", "Bad week but my sister called unprompted and it fixed something.", "happy"),
            ("bot", "Those spontaneous pings can reset the whole emotional weather."),
        ],
    },
    {
        "title": "Imposter feelings at work",
        "stage": "acquaintance",
        "empathy": 0.78,
        "satisfaction": 0.63,
        "turns": [
            ("user", "I'm in meetings with seniors and feel like I'm faking competence.", "anxious"),
            ("bot", "Very common—especially when you're actually growing. Evidence folder helps: wins, praise, shipped work."),
            ("user", "I save screenshots of nice Slack messages now.", "neutral"),
            ("bot", "Cheesy but effective. Add one line each week about what you learned."),
        ],
    },
    {
        "title": "Sleep debt spiral",
        "stage": "stranger",
        "empathy": 0.73,
        "satisfaction": 0.55,
        "turns": [
            ("user", "3 hours sleep, coffee isn't working, I'm irritable.", "angry"),
            ("bot", "Brutal combo. Today's goal is damage control—not heroics."),
            ("user", "I'll block a 20 min nap after standup.", "neutral"),
            ("bot", "Smart. Hydrate, dim screens before tonight, wind-down alarm 45 min out."),
        ],
    },
    {
        "title": "Learning Django & DRF",
        "stage": "acquaintance",
        "empathy": 0.68,
        "satisfaction": 0.74,
        "turns": [
            ("user", "Serializers confuse me—when do I use ModelSerializer vs raw Serializer?", "neutral"),
            ("bot", "ModelSerializer when fields map 1:1 to a model with sane defaults; Serializer when you’re shaping composite or nested DTOs."),
            ("user", "What about validation that touches two models?", "neutral"),
            ("bot", "Override `validate` on the parent serializer, or use a service layer for multi-model writes—keeps views thin."),
        ],
    },
    {
        "title": "Weekend recharge ideas",
        "stage": "trusted",
        "empathy": 0.8,
        "satisfaction": 0.87,
        "turns": [
            ("user", "I want a real break but default to doomscrolling.", "sad"),
            ("bot", "Make the default harder: charger in another room, one offline block Saturday morning."),
            ("user", "Forest walk + no phone sounds doable.", "happy"),
            ("bot", "Doable. Pack water, tell someone your ETA—tiny accountability."),
        ],
    },
]

JOURNALS = [
    {
        "title": "Three wins this Tuesday",
        "mood": "happy",
        "tags": ["work", "gratitude", "momentum"],
        "content": "Shipped the auth refactor, helped a junior unblock their PR, and went for a run before sunset. "
        "Body tired but mind is lighter. Note: keep blocking 45min deep work before standup.",
        "insights": "Theme: momentum builds from small stacked wins. Reflection: you're balancing support and delivery well. "
        "Next step: protect one deep-work block on Wednesday the same way.",
    },
    {
        "title": "Letter I won't send",
        "mood": "angry",
        "tags": ["boundaries", "family", "processing"],
        "content": "Wrote everything I wanted to say after the holiday comment. Deleted nothing from the draft—just vented. "
        "Realized I'm angrier about being dismissed than about the event itself.",
        "insights": "Theme: validation versus the incident. Reflection: naming \"dismissed\" reduces the swirl. "
        "Next step: one sentence boundary you can say calmly if it happens again.",
    },
    {
        "title": "Night brain — catastrophizing",
        "mood": "anxious",
        "tags": ["sleep", "health", "cbt"],
        "content": "1am spiral about savings and rent. Did 4-7-8 breathing, wrote numbers in daylight terms. "
        "Still anxious but dropped from 9/10 to 5/10.",
        "insights": "Theme: nighttime magnification. Reflection: you intervened with skills that work. "
        "Next step: phone across room on weeknights for two weeks as experiment.",
    },
    {
        "title": "Quiet coffee alone",
        "mood": "neutral",
        "tags": ["routine", "solo", "reset"],
        "content": "Sat at the corner café with no podcast. Watched rain. Not profound—just unhurried. "
        "Remember this when I say I have no time.",
        "insights": "Theme: idle time as maintenance. Reflection: you recharge without stimuli. "
        "Next step: bookend weekends with 20 minutes of the same.",
    },
    {
        "title": "Missing home cooking",
        "mood": "sad",
        "tags": ["nostalgia", "food", "belonging"],
        "content": "Made daal; didn't taste like mom's. Video-called her for the tadka timing. Laughed. Cried a little. Worth it.",
        "insights": "Theme: grief and connection coexisting. Reflection: reaching out turned ache into ritual. "
        "Next step: pick one recipe a month to co-cook on call.",
    },
    {
        "title": "Sprint retro takeaway",
        "mood": "neutral",
        "tags": ["work", "team", "process"],
        "content": "We underestimated integration testing. Proposed a hardening day mid-sprint—team agreed. "
        "Hope we actually honor it next cycle.",
        "insights": "Theme: honesty in retros. Reflection: your proposal names systemic risk. "
        "Next step: track whether hardening day stayed protected; bring data if not.",
    },
    {
        "title": "Gym comeback — day 3",
        "mood": "happy",
        "tags": ["health", "discipline", "energy"],
        "content": "Legs sore but mood up. Tracked sets in app. Ate enough protein—finally. Sleep still shaky.",
        "insights": "Theme: habit stacking beats motivation. Reflection: nutrition improved before sleep; that's solvable. "
        "Next step: fixed lights-out alarm, not just wake alarm.",
    },
    {
        "title": "Weird dream — airport",
        "mood": "anxious",
        "tags": ["dreams", "symbols", "low_stakes"],
        "content": "Endless security line, forgot laptop, woke up heart racing. Journaled anyway. Probably job-change subtext.",
        "insights": "Theme: transition anxiety. Reflection: dreams exaggerate logistics fears. "
        "Next step: one real-world prep task today (backup resume, inbox folder).",
    },
]


class Command(BaseCommand):
    help = "Create demotester user with rich chats, emotions, moods, and journals."

    def handle(self, *args, **options):
        rnd = random.Random(42)

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                username=DEMO_USERNAME,
                defaults={"email": DEMO_EMAIL, "first_name": "Demo", "last_name": "Tester"},
            )
            user.email = DEMO_EMAIL
            user.set_password(DEMO_PASSWORD)
            user.is_active = True
            user.save()

            UserProfile.objects.get_or_create(user=user, defaults={"bio": "Seed account for UI, dashboard, chat, and journal QA."})

            # Remove prior seed data for clean re-run
            Conversation.objects.filter(user=user).delete()
            JournalEntry.objects.filter(user=user).delete()
            JournalInsights.objects.filter(user=user).delete()
            DailyMoodSummary.objects.filter(user=user).delete()
            UserChatMemory.objects.filter(user=user).delete()

            mem, _ = UserChatMemory.objects.get_or_create(
                user=user,
                defaults={
                    "preferred_name": "Demo",
                    "facts": [
                        {"k": "role", "v": "Full-stack developer, Django + React"},
                        {"k": "timezone", "v": "UTC+5:30"},
                        {"k": "goal", "v": "Ship emotion-aware chat MVP"},
                    ],
                    "recent_emotions": ["anxious", "happy", "neutral", "sad"],
                    "user_message_count": 0,
                },
            )
            mem.user_message_count = sum(1 for s in CHAT_SCENARIOS for t in s["turns"] if t[0] == "user")
            mem.save(update_fields=["user_message_count", "updated_at"])

            now = timezone.now()
            day_offsets: list[int] = []

            for conv_idx, scenario in enumerate(CHAT_SCENARIOS):
                days_ago = min(20, conv_idx * 2 + rnd.randint(0, 1))
                day_offsets.append(days_ago)
                base = now - timedelta(days=days_ago, hours=rnd.randint(8, 16), minutes=rnd.randint(0, 55))

                conv = Conversation.objects.create(
                    user=user,
                    title=scenario["title"],
                    agent_relationship_stage=scenario["stage"],
                    empathy_effectiveness=float(scenario["empathy"]),
                    user_satisfaction=float(scenario["satisfaction"]),
                    agent_metadata={
                        "seed": True,
                        "scenario_id": conv_idx,
                        "topics": scenario["title"].lower().split()[:4],
                    },
                )
                t_cursor = base
                for role, text, emo in scenario["turns"]:
                    msg = Message.objects.create(conversation=conv, sender=role, content=text)
                    Message.objects.filter(pk=msg.pk).update(created_at=t_cursor, updated_at=t_cursor)
                    if role == "user":
                        primary = emo if emo in dict(EmotionAnalysis.EMOTION_CHOICES) else "neutral"
                        conf = round(0.55 + rnd.uniform(0, 0.4), 2)
                        ea = EmotionAnalysis.objects.create(
                            user=user,
                            message=msg,
                            primary_emotion=primary,
                            emotion_scores=_scores(primary, rnd),
                            emotion_vector=None,
                            confidence=conf,
                        )
                        EmotionAnalysis.objects.filter(pk=ea.pk).update(created_at=t_cursor)

                    t_cursor += timedelta(minutes=rnd.randint(1, 12))

                Conversation.objects.filter(pk=conv.pk).update(created_at=base, updated_at=t_cursor)

            # Daily mood summaries: last 14 days (real aggregates where messages exist, else synthetic for charts)
            for i in range(14):
                d = timezone.localdate() - timedelta(days=i)
                agg = EmotionAnalysis.objects.filter(user=user, created_at__date=d)
                n = agg.count()
                if n == 0:
                    dom = rnd.choice(["happy", "neutral", "anxious", "sad"])
                    dist = {dom: 2, "neutral": 1}
                    mc = 3
                    avg_c = round(0.62 + rnd.uniform(0, 0.2), 2)
                else:
                    dist = {
                        row["primary_emotion"]: row["c"]
                        for row in agg.values("primary_emotion").annotate(c=Count("id"))
                    }
                    dom = max(dist, key=lambda k: dist[k])
                    avg_c = float(agg.aggregate(a=Avg("confidence"))["a"] or 0.68)
                    mc = n
                DailyMoodSummary.objects.update_or_create(
                    user=user,
                    date=d,
                    defaults={
                        "dominant_emotion": dom,
                        "emotion_distribution": dist,
                        "avg_confidence": avg_c,
                        "messages_count": mc,
                    },
                )

            for j_idx, j in enumerate(JOURNALS):
                created = timezone.now() - timedelta(days=j_idx * 2, hours=3 + j_idx)
                entry = JournalEntry(
                    user=user,
                    title=j["title"],
                    content=j["content"],
                    mood_at_entry=j["mood"],
                    ai_insights=j["insights"],
                    tags=j["tags"],
                )
                entry.save()
                JournalEntry.objects.filter(pk=entry.pk).update(created_at=created, updated_at=created)

            today = timezone.localdate()
            week_start = today - timedelta(days=today.weekday())
            week_end = week_start + timedelta(days=6)
            JournalInsights.objects.create(
                user=user,
                period_type="weekly",
                period_start=week_start,
                period_end=week_end,
                top_emotions=[
                    {"emotion": "happy", "count": 12},
                    {"emotion": "anxious", "count": 9},
                    {"emotion": "neutral", "count": 7},
                ],
                patterns="Emotion spikes cluster mid-week; evenings show more anxious language after 21:00 UTC.",
                recommendations="Try a 10-minute wind-down buffer before late Slack; keep one gratitudes line on heavy days.",
                sentiment_trend={"direction": "slightly_up", "delta": 0.04, "window_days": 7},
            )

            month_start = today.replace(day=1)
            if month_start.month == 12:
                next_month = month_start.replace(year=month_start.year + 1, month=1, day=1)
            else:
                next_month = month_start.replace(month=month_start.month + 1, day=1)
            month_end = next_month - timedelta(days=1)

            JournalInsights.objects.create(
                user=user,
                period_type="monthly",
                period_start=month_start,
                period_end=month_end,
                top_emotions=[
                    {"emotion": "happy", "count": 28},
                    {"emotion": "sad", "count": 15},
                    {"emotion": "anxious", "count": 14},
                ],
                patterns="Month shows recovery arcs: low start, rebound after social connection entries.",
                recommendations="Keep weekly outdoor block; journal after hard conversations within 24h.",
                sentiment_trend={"direction": "up", "delta": 0.11, "window_days": 30},
            )

        msg = (
            f"\n{'=' * 60}\n"
            f"  Demo user ready\n"
            f"  Username: {DEMO_USERNAME}\n"
            f"  Password: {DEMO_PASSWORD}\n"
            f"  Email:    {DEMO_EMAIL}\n"
            f"{'=' * 60}\n"
            f"  Conversations: {Conversation.objects.filter(user=user).count()}\n"
            f"  Messages:      {Message.objects.filter(conversation__user=user).count()}\n"
            f"  Emotion rows:  {EmotionAnalysis.objects.filter(user=user).count()}\n"
            f"  Daily moods:   {DailyMoodSummary.objects.filter(user=user).count()}\n"
            f"  Journal:       {JournalEntry.objects.filter(user=user).count()}\n"
            f"  Insights:      {JournalInsights.objects.filter(user=user).count()}\n"
            f"{'=' * 60}\n"
        )
        self.stdout.write(self.style.SUCCESS(msg))
