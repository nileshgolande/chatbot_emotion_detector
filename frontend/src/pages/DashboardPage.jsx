import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import {
  EMOTION_COLORS,
  EMOTION_EMOJIS,
  EMOTION_LABELS,
  EMOTION_ORDER,
  chartAxisProps,
  dominantMoodAxisTick,
  emotionDisplayLabel,
  gridStroke,
  toLineTrendData,
  toPieData,
  toStackedTrendData,
} from "../data/emotionChartTheme";

/** Y-axis positions: bottom → top = anxious … happy (matches scatter / mock). */
const MOOD_JOURNEY_Y = {
  anxious: 0,
  angry: 1,
  sad: 2,
  neutral: 3,
  happy: 4,
};

/** Chart window: last N calendar days through end of today (inclusive). */
const CHART_DAY_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 15, label: "Last 15 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function filterByCalendarDays(points, numDays) {
  if (!Array.isArray(points) || points.length === 0 || !numDays) return [];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (numDays - 1));
  const t0 = start.getTime();
  const t1 = end.getTime();
  return points.filter((p) => {
    const t = new Date(p.at).getTime();
    return t >= t0 && t <= t1;
  });
}

function localDateKey(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dominantFromCounts(counts) {
  let best = "neutral";
  let bestC = -1;
  for (const e of EMOTION_ORDER) {
    const c = counts[e] || 0;
    if (c > bestC) {
      bestC = c;
      best = e;
    }
  }
  return best;
}

/** Build daily rows compatible with `toStackedTrendData` / `toLineTrendData` from per-message timeline points. */
function buildDailyAggregatesFromTimeline(points) {
  if (!Array.isArray(points) || points.length === 0) return [];
  const byDay = new Map();
  for (const p of points) {
    const key = localDateKey(p.at);
    if (!key) continue;
    if (!byDay.has(key)) {
      byDay.set(key, {
        counts: { happy: 0, sad: 0, anxious: 0, angry: 0, neutral: 0 },
        confSum: 0,
        confN: 0,
      });
    }
    const bucket = byDay.get(key);
    const em = p.emotion && bucket.counts[p.emotion] !== undefined ? p.emotion : "neutral";
    bucket.counts[em] += 1;
    if (p.confidence != null && !Number.isNaN(Number(p.confidence))) {
      bucket.confSum += Number(p.confidence);
      bucket.confN += 1;
    }
  }
  const dates = [...byDay.keys()].sort();
  return dates.map((dateFull) => {
    const { counts, confSum, confN } = byDay.get(dateFull);
    const messages_count = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      date: dateFull,
      messages_count,
      dominant_emotion: dominantFromCounts(counts),
      emotion_distribution: { ...counts },
      avg_confidence: confN > 0 ? confSum / confN : null,
    };
  });
}

function emotionCountsFromTimelinePoints(points) {
  const counts = { happy: 0, sad: 0, anxious: 0, angry: 0, neutral: 0 };
  if (!Array.isArray(points)) return counts;
  for (const p of points) {
    const k = p.emotion && counts[p.emotion] !== undefined ? p.emotion : "neutral";
    counts[k] += 1;
  }
  return counts;
}

function prepareJourneyPoints(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p, idx) => ({
    ...p,
    displayIndex: idx + 1,
    moodY: MOOD_JOURNEY_Y[p.emotion] ?? 2,
  }));
}

function buildTodayMoodSnapshot(points) {
  const todayOnly = filterByCalendarDays(points, 1);
  const n = todayOnly.length;
  const keys = ["anxious", "angry", "sad", "neutral", "happy"];

  const counts = { happy: 0, sad: 0, anxious: 0, angry: 0, neutral: 0 };
  for (const p of todayOnly) {
    const k = p.emotion && counts[p.emotion] !== undefined ? p.emotion : "neutral";
    counts[k] += 1;
  }

  const donutSlices = EMOTION_ORDER.map((e) => ({
    name: emotionDisplayLabel(e),
    key: e,
    value: counts[e],
    fill: EMOTION_COLORS[e],
  })).filter((d) => d.value > 0);

  const convIds = new Set();
  for (const p of todayOnly) {
    if (p.conversation_id != null && p.conversation_id !== "") convIds.add(p.conversation_id);
  }
  let chatsToday = convIds.size;
  if (n > 0 && chatsToday === 0) chatsToday = 1;

  if (n === 0) {
    return {
      empty: true,
      count: 0,
      chatsToday: 0,
      emotion: "neutral",
      label: EMOTION_LABELS.neutral,
      donutSlices: [],
    };
  }
  const ys = todayOnly.map((p) => MOOD_JOURNEY_Y[p.emotion] ?? 2);
  const avgY = ys.reduce((a, b) => a + b, 0) / n;
  const emotion = keys[Math.max(0, Math.min(4, Math.round(avgY)))];
  return {
    empty: false,
    count: n,
    chatsToday,
    emotion,
    label: EMOTION_LABELS[emotion] || EMOTION_LABELS.neutral,
    donutSlices,
  };
}

function MoodScoreDonut({ slices, total, isDark }) {
  const hasData = total > 0 && slices.length > 0;

  if (!hasData) {
    return (
      <div className="flex w-[148px] shrink-0 flex-col items-center gap-1">
        <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-full border-[10px] border-slate-200 dark:border-slate-600">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400 dark:text-slate-500">0</p>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">messages</p>
          </div>
        </div>
        <p className="text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">Mood mix</p>
      </div>
    );
  }

  return (
    <div className="flex w-[156px] shrink-0 flex-col items-center gap-1">
      <div className="relative h-[132px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="56%"
              outerRadius="82%"
              paddingAngle={2.5}
              stroke={isDark ? "#111b21" : "#ffffff"}
              strokeWidth={2}
            >
              {slices.map((entry) => (
                <Cell key={entry.key} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                const pct = total ? Math.round((row.value / total) * 100) : 0;
                return (
                  <div className="rounded-lg border border-wa-bar bg-wa-panel px-2.5 py-1.5 text-xs shadow-md">
                    <p className="font-semibold text-slate-900 dark:text-emerald-50">{row.name}</p>
                    <p className="text-wa-muted">
                      {row.value} message{row.value !== 1 ? "s" : ""} · {pct}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-0.5">
          <span className="text-2xl font-bold tabular-nums leading-none text-slate-900 dark:text-emerald-50">
            {total}
          </span>
          <span className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">messages</span>
        </div>
      </div>
      <p className="text-center text-[10px] font-medium text-slate-500 dark:text-slate-400">Today&apos;s mood mix</p>
    </div>
  );
}

function formatGreetingName(user) {
  if (!user?.username) return "there";
  const u = String(user.username).trim();
  if (!u) return "there";
  return u.length === 1 ? u.toUpperCase() : u.charAt(0).toUpperCase() + u.slice(1);
}

function TodayMoodHero({ snapshot, isDark, user }) {
  const accent = EMOTION_COLORS[snapshot.emotion] || EMOTION_COLORS.neutral;
  const name = formatGreetingName(user);
  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
      <p className="mb-3 text-lg font-semibold text-slate-800 dark:text-emerald-100">
        Hi, <span className="text-slate-900 dark:text-white">{name}</span>!
      </p>
      <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className="flex h-[5.25rem] w-[5.25rem] shrink-0 items-center justify-center rounded-full text-[2.75rem] leading-none shadow-inner"
            style={{ backgroundColor: `${accent}22` }}
          >
            {EMOTION_EMOJIS[snapshot.emotion] ?? "😐"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Today&apos;s snapshot
            </p>
            <h2 className="mt-0.5 text-2xl font-bold leading-tight sm:text-[1.65rem]" style={{ color: accent }}>
              {snapshot.empty ? "No messages today yet" : `Feeling ${snapshot.label}`}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {snapshot.empty ? (
                "Send a chat message to see your average mood and today’s mix."
              ) : (
                <>
                  Today ·{" "}
                  <strong className="font-semibold text-slate-800 dark:text-emerald-100">{snapshot.count}</strong>{" "}
                  message{snapshot.count !== 1 ? "s" : ""} ·{" "}
                  <strong className="font-semibold text-slate-800 dark:text-emerald-100">{snapshot.chatsToday}</strong>{" "}
                  chat{snapshot.chatsToday !== 1 ? "s" : ""}
                </>
              )}
            </p>
            {!snapshot.empty && (
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-300/80 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-900 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200">
                  {snapshot.count} messages
                </span>
                <span className="rounded-full border border-indigo-300/80 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/45 dark:text-indigo-200">
                  {snapshot.chatsToday} chats
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-center sm:justify-end">
          <MoodScoreDonut slices={snapshot.donutSlices} total={snapshot.count} isDark={isDark} />
        </div>
      </div>
    </div>
  );
}

/** Display order for journey mood cards (matches product mock). */
const JOURNEY_MOOD_CARD_ORDER = ["happy", "neutral", "sad", "angry", "anxious"];

function buildJourneyMoodBreakdown(rows) {
  const n = rows.length;
  const counts = { happy: 0, neutral: 0, sad: 0, angry: 0, anxious: 0 };
  for (const r of rows) {
    const k = r.emotion && counts[r.emotion] !== undefined ? r.emotion : "neutral";
    counts[k] += 1;
  }
  return JOURNEY_MOOD_CARD_ORDER.map((key) => {
    const c = counts[key];
    const pct = n ? Math.round((c / n) * 100) : 0;
    return {
      key,
      pct,
      count: c,
      fill: EMOTION_COLORS[key],
      label: EMOTION_LABELS[key],
      emoji: EMOTION_EMOJIS[key],
    };
  });
}

function MoodJourneyMoodCards({ breakdown, isDark }) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        Mood mix for the period you selected
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {breakdown.map((m) => (
          <div
            key={m.key}
            className={`flex flex-col rounded-lg border-2 p-2.5 shadow-sm sm:p-3 ${
              m.pct <= 0 ? "border-slate-200 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/20" : ""
            }`}
            style={
              m.pct > 0
                ? {
                    borderColor: m.fill,
                    backgroundColor: isDark ? `${m.fill}18` : `${m.fill}12`,
                  }
                : undefined
            }
          >
            <span className="text-2xl leading-none" aria-hidden>
              {m.emoji}
            </span>
            <p className="mt-2 text-xs font-bold sm:text-sm" style={{ color: m.fill }}>
              {m.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums sm:text-base" style={{ color: m.fill }}>
              {m.pct}%
            </p>
            <div className="mt-auto pt-2.5">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
                role="presentation"
              >
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{
                    width: `${m.pct}%`,
                    backgroundColor: m.fill,
                    minWidth: m.pct > 0 ? "4px" : 0,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeJourneyStats(rows) {
  const n = rows.length;
  if (!n) {
    return {
      total: 0,
      topLabel: "—",
      topEmotion: null,
      positivePct: 0,
      negativePct: 0,
    };
  }
  const counts = {};
  for (const r of rows) {
    const k = r.emotion || "neutral";
    counts[k] = (counts[k] || 0) + 1;
  }
  let topMood = null;
  let topC = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > topC) {
      topC = c;
      topMood = k;
    }
  }
  const pos = (counts.happy || 0) + (counts.neutral || 0);
  const neg = (counts.sad || 0) + (counts.angry || 0) + (counts.anxious || 0);
  return {
    total: n,
    topLabel: topMood ? emotionDisplayLabel(topMood) : "—",
    topEmotion: topMood,
    positivePct: Math.round((pos / n) * 100),
    negativePct: Math.round((neg / n) * 100),
  };
}

/** `YYYY-MM-DD` → `MM-DD-YYYY` for chart tooltips */
function formatDateMmDdYyyy(yyyyMmDd) {
  if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
  const parts = yyyyMmDd.slice(0, 10).split("-");
  if (parts.length !== 3) return yyyyMmDd;
  const [y, m, d] = parts;
  if (!y || !m || !d) return yyyyMmDd;
  return `${m}-${d}-${y}`;
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold capitalize text-slate-900 dark:text-emerald-50">{p.label}</p>
      <p className="text-wa-muted">
        {p.value} messages ·{" "}
        {payload[0].payload.percent != null
          ? `${(payload[0].payload.percent * 100).toFixed(1)}%`
          : ""}
      </p>
    </div>
  );
}

function CustomBarTooltip({ active, label, payload, isStacked }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const dateHeading = row?.dateFull ? formatDateMmDdYyyy(row.dateFull) : label;
  const totalMessages =
    row?.messages != null
      ? row.messages
      : EMOTION_ORDER.reduce((s, e) => s + (Number(row?.[e]) || 0), 0);
  return (
    <div className="max-w-xs rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900 dark:text-emerald-50">{dateHeading}</p>
      {isStacked && (
        <p className="mb-2 text-wa-muted">
          Total messages:{" "}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-emerald-50">{totalMessages}</span>
        </p>
      )}
      {payload
        .filter((x) => x.value > 0)
        .map((x) => (
          <div key={x.dataKey} className="flex justify-between gap-4">
            <span style={{ color: x.color }}>{x.name}</span>
            <span className="text-wa-muted">{x.value}</span>
          </div>
        ))}
      {isStacked && payload[0]?.payload?.dominant && (
        <p className="mt-1 border-t border-wa-bar pt-1 text-wa-muted">
          Avg mood:{" "}
          <span className="font-medium text-slate-900 dark:text-emerald-50">
            {emotionDisplayLabel(payload[0].payload.dominant)}
          </span>
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axis = chartAxisProps(isDark);
  const grid = gridStroke(isDark);

  const [moodTimeline, setMoodTimeline] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartDayRange, setChartDayRange] = useState(90);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const { data } = await api.get("/api/dashboard/mood_timeline/?limit=5000");
        if (!cancelled) {
          setMoodTimeline(data);
        }
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.detail || e.message || "Failed to load dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rawTimelinePoints = moodTimeline?.points;

  const windowTimelinePoints = useMemo(
    () => filterByCalendarDays(rawTimelinePoints, chartDayRange),
    [rawTimelinePoints, chartDayRange]
  );

  const dailyAggregatesInRange = useMemo(
    () => buildDailyAggregatesFromTimeline(windowTimelinePoints),
    [windowTimelinePoints]
  );

  const pieData = useMemo(() => {
    const raw = toPieData(emotionCountsFromTimelinePoints(windowTimelinePoints));
    const total = raw.reduce((a, b) => a + b.value, 0);
    return raw.map((d) => ({ ...d, percent: total ? d.value / total : 0 }));
  }, [windowTimelinePoints]);

  const stackedData = useMemo(() => toStackedTrendData(dailyAggregatesInRange), [dailyAggregatesInRange]);
  const lineData = useMemo(() => toLineTrendData(dailyAggregatesInRange), [dailyAggregatesInRange]);

  const todayMoodSnapshot = useMemo(
    () => buildTodayMoodSnapshot(rawTimelinePoints),
    [rawTimelinePoints]
  );

  const journeyWindowRows = useMemo(
    () => prepareJourneyPoints(windowTimelinePoints),
    [windowTimelinePoints]
  );

  const journeyKpis = useMemo(() => computeJourneyStats(journeyWindowRows), [journeyWindowRows]);

  const journeyMoodBreakdown = useMemo(
    () => buildJourneyMoodBreakdown(journeyWindowRows),
    [journeyWindowRows]
  );

  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="mx-auto min-h-0 min-w-0 w-full max-w-6xl flex-1 overflow-y-auto overscroll-contain px-4 py-8">
        {loading && <p className="text-wa-muted">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <>
          <TodayMoodHero snapshot={todayMoodSnapshot} isDark={isDark} user={user} />
          <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
            <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2">
              {CHART_DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setChartDayRange(opt.value)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    chartDayRange === opt.value
                      ? "border-violet-300 bg-violet-50 text-violet-900 shadow-sm dark:border-violet-600 dark:bg-violet-950/50 dark:text-violet-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-wa-bar dark:bg-wa-panel dark:text-emerald-200/80 dark:hover:bg-slate-800/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <h1 className="w-full text-xl font-semibold text-slate-900 dark:text-emerald-50 sm:ml-2 sm:w-auto sm:text-2xl">
                Mood journey tracker
              </h1>
            </div>

            {moodTimeline?.truncated ? (
              <p className="mb-3 text-xs text-amber-600 dark:text-amber-400">
                Showing the most recent {moodTimeline.returned} messages (limit {moodTimeline.limit}). Total in
                history: {moodTimeline.total_in_db}.
              </p>
            ) : null}

            {journeyWindowRows.length === 0 && rawTimelinePoints?.length > 0 ? (
              <p className="mb-4 text-sm text-wa-muted">
                No messages in this date range. Choose a wider window or add chats that fall in these days.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Messages</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-emerald-50">
                  {journeyKpis.total}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Top mood</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900 dark:text-emerald-50">
                  <span className="text-2xl leading-none" aria-hidden>
                    {journeyKpis.topEmotion ? EMOTION_EMOJIS[journeyKpis.topEmotion] : "—"}
                  </span>
                  <span>{journeyKpis.topEmotion ? EMOTION_LABELS[journeyKpis.topEmotion] : "—"}</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Positive %</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {journeyKpis.positivePct}%
                </p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Happy + neutral</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-wa-bar dark:bg-wa-panel">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Negative %</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {journeyKpis.negativePct}%
                </p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Sad + angry + anxious</p>
              </div>
            </div>

            <MoodJourneyMoodCards breakdown={journeyMoodBreakdown} isDark={isDark} />
          </section>
          </>
        )}

        {!loading && !error && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Overall emotion mix</h2>
            <p className="mb-4 text-xs text-wa-muted">
              Donut = share of messages in the selected period (last {chartDayRange} days) — same range as the pills above.
            </p>
            {pieTotal > 0 ? (
              <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className="h-72 w-full min-h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius="48%"
                        outerRadius="78%"
                        paddingAngle={2}
                        label={({ name, percent }) =>
                          percent > 0.06 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                        }
                        labelLine={false}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} stroke={isDark ? "#111b21" : "#fff"} strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2 text-sm">
                  {pieData.map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: d.fill }} />
                        <span>{d.label}</span>
                      </span>
                      <span className="tabular-nums text-wa-muted">
                        {d.value} ({pieTotal ? ((d.value / pieTotal) * 100).toFixed(1) : 0}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-wa-muted">
                No messages with mood in this range. Pick a wider window or chat on days inside the range.
              </p>
            )}
          </section>
        )}

        {!loading && !error && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Daily emotion stack</h2>
            <p className="mb-4 text-xs text-wa-muted">
              One stacked bar per calendar day in the selected period (last {chartDayRange} days). Height = messages that day.
            </p>
            {stackedData.length > 0 ? (
              <div className="h-80 w-full min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="dateShort" {...axis} tickMargin={8} />
                    <YAxis allowDecimals={false} {...axis} tickMargin={8} />
                    <Tooltip content={<CustomBarTooltip isStacked />} />
                    <Legend wrapperStyle={{ paddingTop: 16 }} />
                    {EMOTION_ORDER.map((e) => (
                      <Bar
                        key={e}
                        dataKey={e}
                        name={emotionDisplayLabel(e)}
                        stackId="emotion"
                        fill={EMOTION_COLORS[e]}
                        radius={[0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-wa-muted">No per-day data in this range.</p>
            )}
          </section>
        )}

        {!loading && !error && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Messages & daily mood</h2>
            <p className="mb-4 text-xs text-wa-muted">
              Same {chartDayRange}-day window as above. <strong>Bar height</strong> = message count that day.{" "}
              <strong>Right axis</strong> = avg mood (😰 → 😄). Purple line connects day-to-day avg mood; dots match the
              emotion color. Hover for counts.
            </p>
            {lineData.length > 0 ? (
            <div className="h-80 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lineData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="dateShort" {...axis} tickMargin={8} />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    {...axis}
                    tickMargin={8}
                    label={{ value: "Messages (count)", angle: -90, position: "insideLeft", fill: axis.tick.fill, fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[-0.25, 4.25]}
                    ticks={[0, 1, 2, 3, 4]}
                    tickFormatter={dominantMoodAxisTick}
                    width={92}
                    {...axis}
                    tickMargin={4}
                    label={{
                      value: "Avg mood",
                      angle: 90,
                      position: "insideRight",
                      fill: axis.tick.fill,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      const dateLine = row?.dateFull ? formatDateMmDdYyyy(row.dateFull) : row?.dateFull;
                      return (
                        <div className="rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium text-slate-900 dark:text-emerald-50">{dateLine}</p>
                          <p className="text-wa-muted">
                            Total messages:{" "}
                            <strong className="text-slate-900 dark:text-emerald-50">{row?.messages}</strong>
                          </p>
                          <p className="text-wa-muted">
                            Avg mood:{" "}
                            <strong style={{ color: EMOTION_COLORS[row?.dominant_emotion] }}>
                              {row?.dominant_emotion
                                ? emotionDisplayLabel(row.dominant_emotion)
                                : "—"}
                            </strong>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="messages"
                    name="Messages / day"
                    fill="#2dd4bf"
                    fillOpacity={0.88}
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="dominantMoodY"
                    name="Avg mood trend"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={(props) => {
                      const { cx, cy, payload } = props;
                      if (cx == null || cy == null) return null;
                      const fill =
                        EMOTION_COLORS[payload?.dominant_emotion] ?? EMOTION_COLORS.neutral;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={fill}
                          stroke={isDark ? "#0f172a" : "#ffffff"}
                          strokeWidth={2}
                        />
                      );
                    }}
                    activeDot={{ r: 8 }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            ) : (
              <p className="text-sm text-wa-muted">No daily trend in this range.</p>
            )}
          </section>
        )}

        {!loading &&
          !error &&
          Array.isArray(rawTimelinePoints) &&
          rawTimelinePoints.length === 0 && (
          <p className="mb-8 rounded-xl border border-dashed border-wa-bar bg-wa-panel/50 p-6 text-center text-sm text-wa-muted">
            No chart data yet. Send a few chat messages to build emotion history and daily summaries.
          </p>
        )}

      </main>
      </div>
    </div>
  );
}
