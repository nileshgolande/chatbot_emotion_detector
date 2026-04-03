import React, { useEffect, useRef } from "react";
import { useTheme } from "../../hooks/useTheme";

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const EMOTION_EMOJI = {
  happy: "😊",
  sad: "💙",
  anxious: "🌿",
  angry: "🕊️",
  neutral: "💬",
};

function emotionBadge(emotion) {
  if (!emotion) return null;
  const map = {
    happy: "bg-emotion-happy/20 text-emotion-happy",
    sad: "bg-emotion-sad/20 text-emotion-sad",
    anxious: "bg-emotion-anxious/20 text-emotion-anxious",
    angry: "bg-emotion-angry/20 text-emotion-angry",
    neutral: "bg-emotion-neutral/20 text-emotion-neutral",
  };
  const cls = map[emotion] || "bg-slate-700 text-slate-200";
  const icon = EMOTION_EMOJI[emotion] || "✨";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] capitalize ${cls}`}>
      <span aria-hidden>{icon}</span>
      {emotion}
    </span>
  );
}

function botCompanionStrip() {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700/90 dark:text-emerald-300/90">
      <span aria-hidden>🫧</span>
      <span>Here for you</span>
      <span aria-hidden>💛</span>
    </div>
  );
}

const WA_WALLPAPER_LIGHT = `${process.env.PUBLIC_URL || ""}/chat-wallpaper-doodle.svg`;
const WA_WALLPAPER_DARK = `${process.env.PUBLIC_URL || ""}/chat-wallpaper-doodle-dark.svg`;

/**
 * WhatsApp-style tiled doodle background + bubbles (see project chat history spec).
 */
export default function MessageList({ messages, loading }) {
  const bottom = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const wallpaper = theme === "dark" ? WA_WALLPAPER_DARK : WA_WALLPAPER_LIGHT;

  return (
    <div
      className="min-h-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2"
      style={{
        backgroundColor: theme === "dark" ? "#0b141a" : "#efeae2",
        backgroundImage: `url(${wallpaper})`,
        backgroundRepeat: "repeat",
        backgroundSize: "412px 412px",
      }}
    >
      {messages.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-slate-600/90 dark:text-wa-muted">
          Select or start a chat, then send a message.
        </p>
      )}
      <ul className="space-y-2">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          const emo = m.emotion?.primary_emotion;
          return (
            <li key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                className={`relative flex max-w-[85%] flex-col rounded-2xl px-3 py-2 ${
                  isUser
                    ? "rounded-tr-md bg-[#d9fdd3] text-slate-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-emerald-700 dark:text-white dark:shadow-sm"
                    : "rounded-tl-md border border-slate-200/80 bg-white text-slate-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-wa-bar/50 dark:bg-wa-bubbleBot dark:text-emerald-50 dark:shadow-sm"
                }`}
              >
                {!isUser && botCompanionStrip()}
                <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                {isUser && emo && <div className="mt-1 flex items-center gap-2">{emotionBadge(emo)}</div>}
                <div
                  className={`mt-1 text-[10px] ${
                    isUser
                      ? "self-end text-right text-slate-500/80 dark:text-emerald-200/50"
                      : "self-start text-left text-slate-500/80 dark:text-emerald-200/50"
                  }`}
                >
                  {timeLabel(m.created_at)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-2 text-sm text-slate-500 shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-wa-bar/50 dark:bg-wa-bubbleBot dark:text-wa-muted">
            <span className="mr-1" aria-hidden>
              ✨
            </span>
            Listening…
          </div>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
