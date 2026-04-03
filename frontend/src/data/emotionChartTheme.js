/**
 * Consistent emotion colors for analytics (WCAG-friendly contrast on white/dark panels).
 */
export const EMOTION_ORDER = ["happy", "sad", "anxious", "angry", "neutral"];

export const EMOTION_COLORS = {
  happy: "#16a34a",
  sad: "#2563eb",
  anxious: "#ea580c",
  angry: "#dc2626",
  neutral: "#64748b",
};

export const EMOTION_LABELS = {
  happy: "Happy",
  sad: "Sad",
  anxious: "Anxious",
  angry: "Angry",
  neutral: "Neutral",
};

/** Pie / donut slices from API `by_emotion` counts */
export function toPieData(byEmotion) {
  if (!byEmotion || typeof byEmotion !== "object") return [];
  return EMOTION_ORDER.filter((k) => (byEmotion[k] || 0) > 0).map((name) => ({
    name,
    label: EMOTION_LABELS[name] || name,
    value: byEmotion[name],
    fill: EMOTION_COLORS[name] || "#64748b",
  }));
}

/** Stacked bars: one row per day with per-emotion counts */
export function toStackedTrendData(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => {
    const dist = p.emotion_distribution || {};
    const row = {
      dateShort: p.date?.slice(5) || "",
      dateFull: p.date || "",
      dominant: p.dominant_emotion,
      messages: p.messages_count ?? 0,
    };
    EMOTION_ORDER.forEach((e) => {
      row[e] = Number(dist[e]) || 0;
    });
    return row;
  });
}

/** Line chart: daily volume + mood for dot coloring */
export function toLineTrendData(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => ({
    dateShort: p.date?.slice(5) || p.date,
    dateFull: p.date,
    messages: p.messages_count ?? 0,
    dominant_emotion: p.dominant_emotion || "neutral",
    confidencePct: p.avg_confidence != null ? Math.round(Number(p.avg_confidence) * 100) : null,
  }));
}

/** Horizontal bar data for period report `by_emotion` */
export function toHorizontalBarData(byEmotion) {
  if (!byEmotion || typeof byEmotion !== "object") return [];
  return EMOTION_ORDER.map((name) => ({
    name: EMOTION_LABELS[name],
    key: name,
    count: byEmotion[name] || 0,
    fill: EMOTION_COLORS[name],
  })).filter((d) => d.count > 0);
}

export function chartAxisProps(isDark) {
  return {
    tick: { fill: isDark ? "#94a3b8" : "#475569", fontSize: 11 },
    stroke: isDark ? "#334155" : "#cbd5e1",
  };
}

export function gridStroke(isDark) {
  return isDark ? "rgba(148, 163, 184, 0.15)" : "rgba(100, 116, 139, 0.2)";
}
