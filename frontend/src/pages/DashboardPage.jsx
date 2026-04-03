import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import api from "../services/api";
import { useTheme } from "../hooks/useTheme";
import {
  EMOTION_COLORS,
  EMOTION_LABELS,
  EMOTION_ORDER,
  chartAxisProps,
  gridStroke,
  toHorizontalBarData,
  toLineTrendData,
  toPieData,
  toStackedTrendData,
} from "../data/emotionChartTheme";

function TimelineMoodDot(props) {
  const { cx, cy, payload, isDark } = props;
  if (cx == null || cy == null || !payload) return null;
  const c = EMOTION_COLORS[payload.emotion] || EMOTION_COLORS.neutral;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={c}
      stroke={isDark ? "#0f172a" : "#ffffff"}
      strokeWidth={1}
    />
  );
}

function MoodLineDot(props) {
  const { cx, cy, payload, isDark } = props;
  if (cx == null || cy == null || !payload) return null;
  const c = EMOTION_COLORS[payload.dominant_emotion] || EMOTION_COLORS.neutral;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={c}
      stroke={isDark ? "#0f172a" : "#ffffff"}
      strokeWidth={2}
    />
  );
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
  return (
    <div className="max-w-xs rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900 dark:text-emerald-50">{label}</p>
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
          Dominant: <span className="capitalize">{payload[0].payload.dominant}</span>
        </p>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const axis = chartAxisProps(isDark);
  const grid = gridStroke(isDark);

  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState(null);
  const [moodTimeline, setMoodTimeline] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const [s, t, tl, w, m] = await Promise.all([
          api.get("/api/dashboard/emotion_stats/"),
          api.get("/api/dashboard/mood_trend/?days=30"),
          api.get("/api/dashboard/mood_timeline/"),
          api.get("/api/dashboard/weekly_report/"),
          api.get("/api/dashboard/monthly_report/"),
        ]);
        if (!cancelled) {
          setStats(s.data);
          setTrend(t.data);
          setMoodTimeline(tl.data);
          setWeekly(w.data);
          setMonthly(m.data);
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

  const points = useMemo(() => trend?.points || trend?.series || [], [trend]);

  const pieData = useMemo(() => {
    const raw = toPieData(stats?.by_emotion);
    const total = raw.reduce((a, b) => a + b.value, 0);
    return raw.map((d) => ({ ...d, percent: total ? d.value / total : 0 }));
  }, [stats]);

  const stackedData = useMemo(() => toStackedTrendData(points), [points]);
  const lineData = useMemo(() => toLineTrendData(points), [points]);
  const hasConfidence = lineData.some((d) => d.confidencePct != null);

  const weeklyBars = useMemo(() => toHorizontalBarData(weekly?.by_emotion), [weekly]);
  const monthlyBars = useMemo(() => toHorizontalBarData(monthly?.by_emotion), [monthly]);

  const timelineData = useMemo(() => {
    const pts = moodTimeline?.points;
    if (!Array.isArray(pts) || pts.length === 0) return [];
    const window = 5;
    return pts.map((p, i) => {
      const a = Math.max(0, i - Math.floor(window / 2));
      const b = Math.min(pts.length, i + Math.ceil(window / 2));
      const slice = pts.slice(a, b);
      const mood_smooth =
        slice.reduce((sum, x) => sum + (Number(x.mood_score) || 0), 0) / slice.length;
      return {
        ...p,
        mood_smooth,
        confidencePct: p.confidence != null ? Math.round(Number(p.confidence) * 100) : null,
        atShort: typeof p.at === "string" ? p.at.replace("T", " ").slice(0, 16) : "",
      };
    });
  }, [moodTimeline]);

  const timelineShowDots = timelineData.length > 0 && timelineData.length <= 120;

  const pieTotal = pieData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="mx-auto min-h-0 min-w-0 w-full max-w-6xl flex-1 overflow-y-auto overscroll-contain px-4 py-8">
        <h1 className="mb-2 text-2xl font-semibold">Mood dashboard</h1>
        <p className="mb-6 text-sm text-wa-muted">
          Charts match your emotion model: green happy, blue sad, orange anxious, red angry, slate neutral.
        </p>

        {loading && <p className="text-wa-muted">Loading…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && stats && (
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-wa-bar bg-wa-panel p-4 shadow-sm">
              <p className="text-xs text-wa-muted">Messages analyzed</p>
              <p className="text-2xl font-semibold tabular-nums">{stats.total_analyzed}</p>
            </div>
            <div className="rounded-xl border border-wa-bar bg-wa-panel p-4 shadow-sm">
              <p className="text-xs text-wa-muted">Latest detected mood</p>
              <p className="text-2xl font-semibold capitalize">
                {stats.latest?.primary_emotion || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-wa-bar bg-wa-panel p-4 shadow-sm">
              <p className="text-xs text-wa-muted">Latest confidence</p>
              <p className="text-2xl font-semibold tabular-nums">
                {stats.latest?.confidence != null ? `${(stats.latest.confidence * 100).toFixed(0)}%` : "—"}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && timelineData.length > 0 && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Mood trend (all chat history)</h2>
            <p className="mb-1 text-xs text-wa-muted">
              Each point is one analyzed user message in time order. Y-axis is a simple valence score: higher is
              happier/lighter, lower is sadder or more tense (happy +2 → sad −1.5). The teal line is a light moving
              average so you see the overall trend; hover for the exact mood label.
            </p>
            {moodTimeline?.truncated ? (
              <p className="mb-4 text-xs text-amber-600 dark:text-amber-400">
                Showing the most recent {moodTimeline.returned} messages (limit {moodTimeline.limit}). Total in
                history: {moodTimeline.total_in_db}.
              </p>
            ) : (
              <p className="mb-4 text-xs text-wa-muted">
                {moodTimeline?.returned} messages · full history loaded
              </p>
            )}
            <div className="h-80 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                  <XAxis
                    dataKey="i"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    {...axis}
                    tickMargin={8}
                    interval="preserveStartEnd"
                    label={{
                      value: "Message order (oldest → newest)",
                      position: "insideBottom",
                      offset: -4,
                      fill: axis.tick.fill,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    domain={[-2.2, 2.2]}
                    {...axis}
                    tickMargin={8}
                    label={{
                      value: "Mood valence",
                      angle: -90,
                      position: "insideLeft",
                      fill: axis.tick.fill,
                      fontSize: 11,
                    }}
                  />
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="max-w-xs rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium text-slate-900 dark:text-emerald-50">
                            #{row?.i} · {row?.atShort || label}
                          </p>
                          <p className="capitalize text-wa-muted">
                            Mood:{" "}
                            <strong style={{ color: EMOTION_COLORS[row?.emotion] }}>{row?.emotion}</strong>
                          </p>
                          <p className="text-wa-muted">
                            Valence:{" "}
                            <strong className="text-slate-900 dark:text-emerald-50">
                              {row?.mood_score != null ? Number(row.mood_score).toFixed(2) : "—"}
                            </strong>
                          </p>
                          {row?.confidencePct != null && (
                            <p className="text-wa-muted">Confidence: {row.confidencePct}%</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke={isDark ? "#64748b" : "#94a3b8"}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="mood_score"
                    name="Per message"
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeOpacity={0.45}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood_smooth"
                    name="Trend (5-msg avg)"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={
                      timelineShowDots
                        ? (props) => <TimelineMoodDot {...props} isDark={isDark} />
                        : false
                    }
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                  <Legend wrapperStyle={{ paddingTop: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {!loading && !error && pieTotal > 0 && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Overall emotion mix</h2>
            <p className="mb-4 text-xs text-wa-muted">Donut = share of analyzed messages (all time).</p>
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
                      <span className="capitalize">{d.label}</span>
                    </span>
                    <span className="tabular-nums text-wa-muted">
                      {d.value} ({pieTotal ? ((d.value / pieTotal) * 100).toFixed(1) : 0}%)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {!loading && !error && stackedData.length > 0 && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Daily emotion stack</h2>
            <p className="mb-4 text-xs text-wa-muted">
              Stacked bars from your daily mood summaries (last {trend?.days ?? 30} days). Height = messages that day.
            </p>
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
                      name={EMOTION_LABELS[e]}
                      stackId="emotion"
                      fill={EMOTION_COLORS[e]}
                      radius={[0, 0, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {!loading && !error && lineData.length > 0 && (
          <section className="mb-10 rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold">Activity & mood trend</h2>
            <p className="mb-4 text-xs text-wa-muted">
              Area = messages per day. Dots are colored by <strong>dominant</strong> mood that day.
              {hasConfidence ? " Purple line = avg confidence (right axis)." : ""}
            </p>
            <div className="h-80 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lineData} margin={{ top: 8, right: hasConfidence ? 48 : 12, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="msgFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00a884" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#00a884" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="dateShort" {...axis} tickMargin={8} />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    {...axis}
                    tickMargin={8}
                    label={{ value: "Messages", angle: -90, position: "insideLeft", fill: axis.tick.fill, fontSize: 11 }}
                  />
                  {hasConfidence && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, 100]}
                      {...axis}
                      tickMargin={8}
                      label={{
                        value: "Confidence %",
                        angle: 90,
                        position: "insideRight",
                        fill: axis.tick.fill,
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload;
                      return (
                        <div className="rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium text-slate-900 dark:text-emerald-50">{row?.dateFull || label}</p>
                          <p className="text-wa-muted">
                            Messages: <strong className="text-slate-900 dark:text-emerald-50">{row?.messages}</strong>
                          </p>
                          <p className="capitalize text-wa-muted">
                            Dominant:{" "}
                            <strong style={{ color: EMOTION_COLORS[row?.dominant_emotion] }}>
                              {row?.dominant_emotion}
                            </strong>
                          </p>
                          {row?.confidencePct != null && (
                            <p className="text-wa-muted">Confidence: {row.confidencePct}%</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="messages"
                    stroke="#00a884"
                    strokeWidth={2}
                    fill="url(#msgFill)"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="messages"
                    stroke="#047857"
                    strokeWidth={0}
                    dot={(props) => <MoodLineDot {...props} isDark={isDark} />}
                    activeDot={{ r: 7 }}
                  />
                  {hasConfidence && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="confidencePct"
                      name="Confidence %"
                      stroke="#818cf8"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {!loading && !error && (weeklyBars.length > 0 || monthlyBars.length > 0) && (
          <section className="mb-10 grid gap-6 lg:grid-cols-2">
            {weeklyBars.length > 0 && (
              <div className="rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold">This week</h2>
                <p className="mb-4 text-xs text-wa-muted">
                  {weekly?.start} → {weekly?.end} · {weekly?.emotion_analyses_count} analyses
                </p>
                <div className="h-64 w-full min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={weeklyBars}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} {...axis} />
                      <YAxis type="category" dataKey="name" width={72} {...axis} tickMargin={4} />
                      <Tooltip
                        cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
                              <span style={{ color: payload[0].payload.fill }}>{payload[0].payload.name}</span>
                              <p className="font-semibold text-slate-900 dark:text-emerald-50">{payload[0].value}</p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Messages">
                        {weeklyBars.map((e) => (
                          <Cell key={e.key} fill={e.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {monthlyBars.length > 0 && (
              <div className="rounded-2xl border border-wa-bar bg-wa-panel p-5 shadow-sm">
                <h2 className="mb-1 text-lg font-semibold">This month</h2>
                <p className="mb-4 text-xs text-wa-muted">
                  {monthly?.start} → {monthly?.end} · {monthly?.emotion_analyses_count} analyses
                </p>
                <div className="h-64 w-full min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={monthlyBars}
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} {...axis} />
                      <YAxis type="category" dataKey="name" width={72} {...axis} tickMargin={4} />
                      <Tooltip
                        cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" }}
                        content={({ active, payload }) =>
                          active && payload?.[0] ? (
                            <div className="rounded-lg border border-wa-bar bg-wa-panel px-3 py-2 text-xs shadow-lg">
                              <span style={{ color: payload[0].payload.fill }}>{payload[0].payload.name}</span>
                              <p className="font-semibold text-slate-900 dark:text-emerald-50">{payload[0].value}</p>
                            </div>
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Messages">
                        {monthlyBars.map((e) => (
                          <Cell key={e.key} fill={e.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}

        {!loading && !error && pieTotal === 0 && stackedData.length === 0 && (
          <p className="mb-8 rounded-xl border border-dashed border-wa-bar bg-wa-panel/50 p-6 text-center text-sm text-wa-muted">
            No chart data yet. Send a few chat messages to build emotion history and daily summaries.
          </p>
        )}

      </main>
      </div>
    </div>
  );
}
