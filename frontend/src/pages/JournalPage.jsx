import React, { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { EMOTION_EMOJIS, EMOTION_ORDER } from "../data/emotionChartTheme";

const MOODS = ["happy", "sad", "anxious", "angry", "neutral"];

/** Reference design palette */
const JK = {
  purple: "#4A3F8F",
  blue: "#378ADD",
  green: "#639922",
  orange: "#D85A30",
  red: "#E24B4A",
  gray: "#888780",
};

const EMOTION_JOURNAL = {
  happy: { color: JK.green, bg: "rgba(99,153,34,0.08)", border: "rgba(99,153,34,0.22)", emoji: EMOTION_EMOJIS.happy },
  neutral: { color: JK.blue, bg: "rgba(55,138,221,0.08)", border: "rgba(55,138,221,0.22)", emoji: EMOTION_EMOJIS.neutral },
  sad: { color: JK.gray, bg: "rgba(136,135,128,0.08)", border: "rgba(136,135,128,0.22)", emoji: EMOTION_EMOJIS.sad },
  angry: { color: JK.red, bg: "rgba(226,75,74,0.08)", border: "rgba(226,75,74,0.22)", emoji: EMOTION_EMOJIS.angry },
  anxious: { color: JK.orange, bg: "rgba(216,90,48,0.08)", border: "rgba(216,90,48,0.22)", emoji: EMOTION_EMOJIS.anxious },
};

function localISODate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, delta) {
  const [y, mo, da] = iso.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + delta);
  return localISODate(dt);
}

const DEMO_DIGEST = (iso) => ({
  date: iso,
  date_label: "Demo day",
  quote: "Your emotions are valid. Every feeling you experience today is a message worth listening to.",
  write_prompt: "What's one thing you felt deeply today — something you haven't said out loud yet?",
  dominant_emotion: "neutral",
  story: {
    headline: "A calm and steady day — you kept your balance.",
    badge_label: `${EMOTION_EMOJIS.neutral} Mostly neutral`,
    paragraphs: [
      "In demo mode we show sample copy. Log in and chat to build a real timeline from your messages.",
      "Your journal will summarize mood patterns and gentle insights from your history.",
      "You can still save private entries below whenever you like.",
    ],
    tags: [
      { text: "Demo preview", emotion: "neutral" },
      { text: "Chat for data", emotion: "happy" },
    ],
    source_message_count: 0,
  },
  wellness_score: 55,
  messages_today: 0,
  day_streak: 0,
  vs_yesterday_messages: 0,
  emotion_pct: { happy: 18, neutral: 52, sad: 10, angry: 8, anxious: 12 },
  emotion_counts: { happy: 0, sad: 0, anxious: 0, angry: 0, neutral: 0 },
  timeline: [],
  streak_30: Array.from({ length: 30 }, (_, i) => ({
    date: addDaysISO(iso, -29 + i),
    dominant_emotion: ["neutral", "happy", "anxious"][i % 3],
  })),
  insights: [
    {
      icon: "✨",
      title: "Start with real conversations",
      body: "After you register and chat, this page fills from your emotion-aware history—timelines, streaks, and personalized lines like the reference design.",
      tone: "purple",
    },
  ],
  narrative_source: "demo",
});

const INSIGHT_TONE = {
  purple: "bg-[#4A3F8F]/10 border-[#4A3F8F]/25 text-[#4A3F8F]",
  green: "bg-[#639922]/10 border-[#639922]/25 text-[#3B6D11]",
  orange: "bg-[#D85A30]/10 border-[#D85A30]/25 text-[#993C1D]",
  slate: "bg-slate-500/10 border-slate-400/25 text-slate-700 dark:text-slate-300",
};

export default function JournalPage() {
  const { user } = useAuth();
  const isDemo = user?.is_demo || localStorage.getItem("chat_demo") === "1";

  const todayIso = useMemo(() => localISODate(), []);
  const [anchorISO, setAnchorISO] = useState(todayIso);
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(true);
  const [digestError, setDigestError] = useState(null);

  const [entries, setEntries] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    mood_at_entry: "neutral",
  });

  const [reflectText, setReflectText] = useState("");
  const [reflectOut, setReflectOut] = useState(null);
  const [reflectLoading, setReflectLoading] = useState(false);

  const isToday = anchorISO === todayIso;
  const isYesterday = anchorISO === addDaysISO(todayIso, -1);

  const loadDigest = useCallback(async () => {
    setDigestError(null);
    setDigestLoading(true);
    if (isDemo) {
      setDigest(DEMO_DIGEST(anchorISO));
      setDigestLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/api/journal/entries/daily_digest/", {
        params: { date: anchorISO },
      });
      setDigest(data);
    } catch (e) {
      setDigestError(e.response?.data?.detail || e.message || "Could not load daily digest.");
      setDigest(null);
    } finally {
      setDigestLoading(false);
    }
  }, [anchorISO, isDemo]);

  useEffect(() => {
    loadDigest();
  }, [loadDigest]);

  const loadEntries = useCallback(async () => {
    if (isDemo) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }
    setEntriesLoading(true);
    try {
      const { data } = await api.get("/api/journal/entries/");
      const list = Array.isArray(data) ? data : data.results || [];
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const dom = digest?.dominant_emotion && EMOTION_JOURNAL[digest.dominant_emotion]
    ? EMOTION_JOURNAL[digest.dominant_emotion]
    : EMOTION_JOURNAL.neutral;

  const storyCardStyle = {
    background: dom.bg,
    borderColor: dom.border,
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (isDemo) {
      setError("Log in to save journal entries to your account.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/api/journal/entries/", {
        title: form.title.trim() || "Untitled",
        content: form.content.trim(),
        mood_at_entry: form.mood_at_entry,
        tags: [],
      });
      setEntries((prev) => [data, ...prev]);
      setForm({ title: "", content: "", mood_at_entry: "neutral" });
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === "object" ? JSON.stringify(d) : err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const quickReflect = async () => {
    const text = reflectText.trim();
    if (!text) return;
    if (isDemo) {
      const low = text.toLowerCase();
      let mood = "neutral";
      if (/(sad|cry|hurt|lonely)/.test(low)) mood = "sad";
      else if (/(angry|frustrat|annoyed)/.test(low)) mood = "angry";
      else if (/(anxious|worr|nervous|stress)/.test(low)) mood = "anxious";
      else if (/(happy|great|grateful|love)/.test(low)) mood = "happy";
      const lines = {
        happy: "What a beautiful thing to notice—that warmth matters.",
        sad: "Thank you for trusting this space with something tender.",
        angry: "That frustration makes sense; you’re allowed to feel it fully.",
        anxious: "Anxiety can shrink the world; you’re safe in this moment.",
        neutral: "Quiet reflections have strength too.",
      };
      setReflectOut({ mood_guess: mood, reply: lines[mood] || lines.neutral });
      return;
    }
    setReflectLoading(true);
    setReflectOut(null);
    try {
      const { data } = await api.post("/api/journal/entries/quick_reflect/", { text });
      setReflectOut(data);
    } catch (e) {
      setReflectOut({
        mood_guess: "neutral",
        reply: e.response?.data?.detail || e.message || "Could not get a response.",
      });
    } finally {
      setReflectLoading(false);
    }
  };

  const generateInsights = async (id) => {
    if (isDemo) return;
    setError(null);
    try {
      const { data } = await api.post(`/api/journal/entries/${id}/generate_insights/`);
      setEntries((prev) => prev.map((x) => (x.id === id ? data : x)));
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Insights failed.");
    }
  };

  const msgBarPct = Math.min(100, (digest?.messages_today || 0) * 6 + 12);
  const streakBarPct = Math.min(100, (digest?.day_streak || 0) * 10);
  const vs = digest?.vs_yesterday_messages ?? 0;
  const vsPositive = vs >= 0;

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="mx-auto min-h-0 min-w-0 w-full max-w-4xl flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:py-8">
          {/* Top bar — match reference */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-slate-500 dark:text-slate-400">
                Daily emotional journal
              </p>
              <h1 className="mt-0.5 text-xl font-medium text-slate-900 dark:text-emerald-50 md:text-[22px]">
                {digestLoading ? "…" : digest?.date_label || anchorISO}
              </h1>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setAnchorISO(addDaysISO(todayIso, -1))}
                className={`rounded-full border px-3.5 py-1 text-[11px] transition ${
                  isYesterday
                    ? "border-transparent bg-[#4A3F8F] text-white"
                    : "border-wa-bar bg-transparent text-wa-muted hover:bg-wa-bar/40"
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setAnchorISO(todayIso)}
                className={`rounded-full border px-3.5 py-1 text-[11px] transition ${
                  isToday
                    ? "border-transparent bg-[#4A3F8F] text-white"
                    : "border-wa-bar bg-transparent text-wa-muted hover:bg-wa-bar/40"
                }`}
              >
                Today
              </button>
            </div>
          </div>

          {isDemo && (
            <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-900 dark:text-amber-100">
              Demo mode: digest is sample. Log in and use chat to populate real history.
            </p>
          )}

          {digestError && (
            <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {digestError}
            </p>
          )}

          {!digestLoading && digest && (
            <>
              <div
                className="mb-4 flex gap-3.5 rounded-2xl border px-5 py-5"
                style={{
                  background: "rgba(74,63,143,0.06)",
                  borderColor: "rgba(74,63,143,0.2)",
                }}
              >
                <span className="mt-0.5 text-2xl shrink-0">💬</span>
                <div>
                  <p className="text-sm italic leading-relaxed text-slate-800 dark:text-emerald-100">
                    &ldquo;{digest.quote}&rdquo;
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium" style={{ color: JK.purple }}>
                    — Your AI companion
                  </p>
                </div>
              </div>

              <article
                className="relative mb-4 overflow-hidden rounded-[20px] border p-6 md:p-7"
                style={storyCardStyle}
              >
                <div
                  className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium"
                  style={{ background: dom.bg, color: dom.color }}
                >
                  <span>{digest.story?.badge_label || `${dom.emoji} ${digest.dominant_emotion}`}</span>
                </div>
                <h2 className="mb-3.5 text-lg font-medium leading-snug md:text-xl" style={{ color: dom.color }}>
                  {digest.story?.headline}
                </h2>
                <div className="space-y-2.5 text-sm leading-[1.85] text-slate-800 dark:text-emerald-50/95">
                  {(digest.story?.paragraphs || []).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-4 dark:border-white/10">
                  <div className="flex flex-wrap gap-1.5">
                    {(digest.story?.tags || []).map((tag, i) => {
                      const meta = EMOTION_JOURNAL[tag.emotion] || EMOTION_JOURNAL.neutral;
                      return (
                        <span
                          key={i}
                          className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                          style={{
                            color: meta.color,
                            borderColor: `${meta.color}55`,
                            background: `${meta.color}11`,
                          }}
                        >
                          {tag.text}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ✦ Based on your {digest.story?.source_message_count ?? 0} reflected message
                    {(digest.story?.source_message_count || 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </article>

              <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <div className="rounded-[14px] bg-wa-bar/60 p-3.5 dark:bg-wa-panel/80">
                  <div className="mb-1.5 text-xl">🧘</div>
                  <div className="text-[22px] font-medium" style={{ color: JK.purple }}>
                    {digest.wellness_score}
                  </div>
                  <p className="mt-0.5 text-[11px] text-wa-muted">Wellness score</p>
                  <div className="mt-2 h-1 w-full rounded-sm bg-wa-bar">
                    <div
                      className="h-1 rounded-sm transition-all"
                      style={{
                        width: `${Math.min(100, digest.wellness_score)}%`,
                        background: "#7F77DD",
                      }}
                    />
                  </div>
                </div>
                <div className="rounded-[14px] bg-wa-bar/60 p-3.5 dark:bg-wa-panel/80">
                  <div className="mb-1.5 text-xl">💬</div>
                  <div className="text-[22px] font-medium" style={{ color: JK.blue }}>
                    {digest.messages_today}
                  </div>
                  <p className="mt-0.5 text-[11px] text-wa-muted">Messages (this day)</p>
                  <div className="mt-2 h-1 w-full rounded-sm bg-wa-bar">
                    <div
                      className="h-1 rounded-sm bg-[#378ADD]"
                      style={{ width: `${msgBarPct}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-[14px] bg-wa-bar/60 p-3.5 dark:bg-wa-panel/80">
                  <div className="mb-1.5 text-xl">🔥</div>
                  <div className="text-[22px] font-medium" style={{ color: JK.orange }}>
                    {digest.day_streak}
                  </div>
                  <p className="mt-0.5 text-[11px] text-wa-muted">Day streak</p>
                  <div className="mt-2 h-1 w-full rounded-sm bg-wa-bar">
                    <div
                      className="h-1 rounded-sm bg-[#D85A30]"
                      style={{ width: `${streakBarPct}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-[14px] bg-wa-bar/60 p-3.5 dark:bg-wa-panel/80">
                  <div className="mb-1.5 text-xl">📈</div>
                  <div
                    className="text-[22px] font-medium"
                    style={{ color: vsPositive ? JK.green : JK.red }}
                  >
                    {vsPositive ? "+" : ""}
                    {vs}
                  </div>
                  <p className="mt-0.5 text-[11px] text-wa-muted">vs yesterday</p>
                  <div className="mt-2 h-1 w-full rounded-sm bg-wa-bar">
                    <div
                      className="h-1 rounded-sm bg-[#639922]"
                      style={{
                        width: `${Math.min(100, 40 + Math.abs(vs) * 5)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mb-3.5 grid gap-3.5 md:grid-cols-[1.15fr_1fr]">
                <section className="rounded-[18px] border border-wa-bar bg-wa-panel/50 p-5 dark:bg-wa-panel/30">
                  <h3 className="text-[13px] font-medium">How your day unfolded</h3>
                  <p className="mb-3.5 text-[11px] text-wa-muted">
                    Message-by-message emotion timeline
                  </p>
                  <div className="flex flex-col">
                    {(digest.timeline || []).length === 0 ? (
                      <p className="text-xs text-wa-muted">
                        No chat messages with mood data for this day yet.
                      </p>
                    ) : (
                      (digest.timeline || []).map((row, idx, arr) => {
                        const em = EMOTION_JOURNAL[row.emotion] || EMOTION_JOURNAL.neutral;
                        const last = idx === arr.length - 1;
                        return (
                          <div
                            key={idx}
                            className={`relative flex gap-3.5 pb-4 ${last ? "pb-0" : ""}`}
                          >
                            {!last && (
                              <div
                                className="absolute left-[18px] top-9 bottom-0 w-[1.5px] bg-wa-bar"
                                aria-hidden
                              />
                            )}
                            <div
                              className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] text-lg"
                              style={{
                                background: em.bg,
                                borderColor: em.color,
                              }}
                            >
                              {em.emoji}
                            </div>
                            <div className="min-w-0 flex-1 pt-1">
                              <p className="mb-0.5 text-[10px] text-wa-muted">{row.time}</p>
                              <p className="text-xs italic leading-snug text-slate-600 dark:text-emerald-200/80">
                                &ldquo;{row.content}
                                {row.content?.length >= 400 ? "…" : ""}&rdquo;
                              </p>
                              <p className="mt-1 text-[10px] font-medium" style={{ color: em.color }}>
                                {row.emotion?.charAt(0).toUpperCase() + row.emotion?.slice(1)} detected
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-[18px] border border-wa-bar bg-wa-panel/50 p-5 dark:bg-wa-panel/30">
                  <h3 className="text-[13px] font-medium">Emotion breakdown</h3>
                  <p className="mb-3.5 text-[11px] text-wa-muted">Time in each mood (this day)</p>
                  <div className="flex flex-col gap-2">
                    {EMOTION_ORDER.map((key) => {
                      const em = EMOTION_JOURNAL[key];
                      const pct = digest.emotion_pct?.[key] ?? 0;
                      return (
                        <div key={key} className="flex items-center gap-2.5">
                          <span className="flex w-[72px] shrink-0 items-center gap-1 text-xs text-wa-muted">
                            <span>{em.emoji}</span>
                            <span className="capitalize">{key}</span>
                          </span>
                          <div className="h-2.5 flex-1 overflow-hidden rounded-md bg-wa-bar">
                            <div
                              className="h-full rounded-md transition-[width] duration-700 ease-out"
                              style={{ width: `${pct}%`, background: em.color }}
                            />
                          </div>
                          <span className="w-8 text-right text-[11px] text-wa-muted">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <h4 className="text-[13px] font-medium">30-day mood map</h4>
                    <p className="mt-0.5 text-[11px] text-wa-muted">Hover a square</p>
                    <div className="mt-2.5 flex flex-wrap gap-0.5">
                      {(digest.streak_30 || []).map((cell, i) => {
                        const em = EMOTION_JOURNAL[cell.dominant_emotion] || EMOTION_JOURNAL.neutral;
                        const short = cell.date?.slice(5)?.replace("-", "/") || "";
                        return (
                          <div
                            key={i}
                            title={`${cell.date} · ${em.emoji} ${cell.dominant_emotion}`}
                            className="h-7 w-7 cursor-default rounded-md opacity-[0.82] transition hover:opacity-100"
                            style={{ background: em.color }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>

              <div className="mb-4 flex flex-col gap-2">
                {(digest.insights || []).map((ins, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-[14px] border px-3.5 py-3.5 ${INSIGHT_TONE[ins.tone] || INSIGHT_TONE.purple}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/50 text-base dark:bg-black/20">
                      {ins.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-medium">{ins.title}</p>
                      <p className="text-xs leading-snug opacity-90 dark:text-emerald-100/85">
                        {ins.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Write + AI reflect */}
          <section className="mb-8 rounded-[18px] border border-wa-bar bg-wa-panel/40 p-5 dark:bg-wa-panel/25">
            <h3 className="mb-1 text-[13px] font-medium">Add your own thoughts</h3>
            <p className="mb-3 text-[13px] leading-relaxed text-wa-muted">
              {digest?.write_prompt ||
                "What's one thing you felt deeply today — something you haven't said out loud yet?"}
            </p>
            <textarea
              value={reflectText}
              onChange={(e) => setReflectText(e.target.value)}
              placeholder="Write freely. There's no right or wrong answer here..."
              rows={4}
              className="w-full resize-none rounded-xl border border-wa-bar bg-wa-bar/50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-900 outline-none focus:border-[#7F77DD] dark:bg-wa-bg dark:text-emerald-50"
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={quickReflect}
                disabled={reflectLoading || !reflectText.trim()}
                className="rounded-full bg-[#4A3F8F] px-6 py-2.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {reflectLoading ? "…" : "✦ Get AI response"}
              </button>
              <span className="text-[11px] text-wa-muted">
                Your words are private and only used to support you
              </span>
            </div>
            {reflectOut && (
              <div
                className="mt-3.5 rounded-2xl border border-wa-bar p-4"
                style={{
                  background: EMOTION_JOURNAL[reflectOut.mood_guess]?.bg || EMOTION_JOURNAL.neutral.bg,
                  borderColor: EMOTION_JOURNAL[reflectOut.mood_guess]?.border,
                }}
              >
                <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium">
                  <span className="text-lg">{EMOTION_JOURNAL[reflectOut.mood_guess]?.emoji}</span>
                  <span style={{ color: EMOTION_JOURNAL[reflectOut.mood_guess]?.color }}>
                    I sense {reflectOut.mood_guess} in your words
                  </span>
                  <span className="ml-auto text-wa-muted">✦ AI response</span>
                </p>
                <p className="text-[13px] leading-relaxed text-slate-800 dark:text-emerald-50">
                  {reflectOut.reply}
                </p>
              </div>
            )}
          </section>

          {/* Saved entries */}
          <section className="rounded-[18px] border border-wa-bar bg-wa-panel/30 p-5">
            <h3 className="mb-3 text-[13px] font-medium">Save a journal entry</h3>
            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
            <form onSubmit={onSubmit} className="mb-6 space-y-3">
              <input
                name="title"
                value={form.title}
                onChange={onChange}
                placeholder="Title (optional)"
                className="w-full rounded-xl border border-wa-bar bg-wa-bar/40 px-3 py-2 text-sm dark:bg-wa-bg"
              />
              <select
                name="mood_at_entry"
                value={form.mood_at_entry}
                onChange={onChange}
                className="w-full rounded-xl border border-wa-bar bg-wa-bar/40 px-3 py-2 text-sm dark:bg-wa-bg"
              >
                {MOODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <textarea
                name="content"
                value={form.content}
                onChange={onChange}
                rows={4}
                required
                placeholder="Longer entry to keep in your history…"
                className="w-full rounded-xl border border-wa-bar bg-wa-bar/40 px-3 py-2 text-sm dark:bg-wa-bg"
              />
              <button
                type="submit"
                disabled={saving || isDemo}
                className="rounded-full border border-wa-bar bg-wa-accent/20 px-4 py-2 text-xs font-medium text-emerald-900 disabled:opacity-50 dark:text-emerald-100"
              >
                {saving ? "Saving…" : "Save entry"}
              </button>
            </form>

            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-wa-muted">
              Your saved entries
            </h4>
            {entriesLoading ? (
              <p className="text-xs text-wa-muted">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-wa-muted">No saved entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="rounded-xl border border-wa-bar bg-wa-bar/30 p-3 text-sm dark:bg-wa-panel/40"
                  >
                    <div className="mb-1 flex flex-wrap justify-between gap-2">
                      <span className="font-medium">{e.title}</span>
                      <span className="text-xs capitalize text-wa-muted">{e.mood_at_entry}</span>
                    </div>
                    <p className="mb-2 whitespace-pre-wrap text-xs text-wa-muted">{e.content}</p>
                    {e.ai_insights && (
                      <p className="mb-2 rounded-lg bg-wa-bar/40 p-2 text-xs">{e.ai_insights}</p>
                    )}
                    {!isDemo && (
                      <button
                        type="button"
                        onClick={() => generateInsights(e.id)}
                        className="text-[11px] text-[#4A3F8F] underline dark:text-wa-accent"
                      >
                        Generate AI insights
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
