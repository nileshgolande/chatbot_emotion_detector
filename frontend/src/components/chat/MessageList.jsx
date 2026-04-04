import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "../../hooks/useTheme";

/** Time only in the user's locale (e.g. 1:18 pm) — lowercase like WhatsApp. */
function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function formatFullDateLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const WA_WALLPAPER_LIGHT = `${process.env.PUBLIC_URL || ""}/chat-wallpaper-doodle.svg`;
const WA_WALLPAPER_DARK = `${process.env.PUBLIC_URL || ""}/chat-wallpaper-doodle-dark.svg`;

const CLICK_DELAY_MS = 280;

/** WhatsApp-style outgoing receipt: sending | delivered (gray ✓✓) | read (blue ✓✓) */
function userMessageReceipt(index, m, messages) {
  if (m.sender !== "user") return null;
  if (String(m.id).startsWith("tmp-")) return "sending";
  const botAfter = messages.slice(index + 1).some((x) => x.sender === "bot");
  if (botAfter) return "read";
  return "delivered";
}

/** Double checkmarks — gray (delivered) or WhatsApp blue (read). */
function WhatsAppTicks({ status, deliveredColor = "#667781" }) {
  if (status === "sending") {
    return (
      <span
        className="inline-flex shrink-0 pb-px opacity-80"
        style={{ color: deliveredColor }}
        aria-label="Sending"
        title="Sending…"
      >
        <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden>
          <path
            d="M7 1v3.5l2.2 1.3M7 9.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  const isRead = status === "read";
  const color = isRead ? "#53bdeb" : deliveredColor;
  const label = isRead ? "Read" : "Delivered";
  return (
    <span
      className="inline-flex shrink-0 items-end leading-none"
      style={{ color }}
      aria-label={label}
      title={label}
    >
      <svg width="18" height="11" viewBox="0 0 18 11" fill="none" className="overflow-visible" aria-hidden>
        <path
          d="M1 6.2 L3.8 9 L7.5 4.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 6.2 L8.5 10 L17 1.2"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * WhatsApp-style tiled background + bubbles.
 * Single click: highlight message / show full date on the time line.
 * Double click: reply to that message (composer).
 * Outgoing: time + delivery ticks (sending → delivered → read when bot replies).
 */
export default function MessageList({ messages, loading, onReply }) {
  const bottom = useRef(null);
  const { theme } = useTheme();
  const [highlightedId, setHighlightedId] = useState(null);
  const [showFullTimeForId, setShowFullTimeForId] = useState(null);
  const clickTimer = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const onBubbleClick = useCallback((m) => {
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setHighlightedId((id) => (id === m.id ? null : m.id));
      setShowFullTimeForId((id) => (id === m.id ? null : m.id));
    }, CLICK_DELAY_MS);
  }, []);

  const onBubbleDoubleClick = useCallback(
    (m) => {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setHighlightedId(m.id);
      onReply?.({
        id: m.id,
        sender: m.sender,
        content: (m.content || "").trim(),
        created_at: m.created_at,
      });
    },
    [onReply],
  );

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
      <p className="sr-only">
        Single-click a message to select and see the full time. Double-click to reply. Outgoing
        messages show WhatsApp-style ticks: gray when delivered, blue when read.
      </p>
      {messages.length === 0 && !loading && (
        <p className="py-8 text-center text-sm text-slate-600/90 dark:text-wa-muted">
          Select or start a chat, then send a message.
        </p>
      )}
      <ul className="space-y-2">
        {messages.map((m, index) => {
          const isUser = m.sender === "user";
          const isHi = highlightedId === m.id;
          const receipt = userMessageReceipt(index, m, messages);
          return (
            <li key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onBubbleClick(m)}
                onDoubleClick={() => onBubbleDoubleClick(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onBubbleClick(m);
                  }
                }}
                className={`relative flex max-w-[85%] cursor-pointer select-none flex-col rounded-2xl px-2.5 pb-1.5 pt-2 outline-none transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  isUser
                    ? "rounded-tr-sm bg-[#d9fdd3] text-slate-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-emerald-700 dark:text-white dark:shadow-sm"
                    : "rounded-tl-md border border-slate-200/80 bg-white text-slate-900 shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-wa-bar/50 dark:bg-wa-bubbleBot dark:text-emerald-50 dark:shadow-sm"
                } ${isHi ? "ring-2 ring-emerald-500/65 dark:ring-emerald-400/50" : ""}`}
                title="Click: select · Double-click: reply"
              >
                <p className="whitespace-pre-wrap break-words px-0.5 text-sm leading-snug">{m.content}</p>
                <div
                  className={`mt-0.5 flex min-h-[1rem] items-end justify-end gap-1 tabular-nums ${
                    isUser
                      ? "text-slate-600/90 dark:text-emerald-100/75"
                      : "justify-start text-slate-500/90 dark:text-emerald-200/60"
                  }`}
                >
                  <time
                    dateTime={m.created_at || undefined}
                    className={`shrink-0 pb-px text-[11px] leading-none ${
                      showFullTimeForId === m.id ? "text-[9px] leading-tight" : ""
                    }`}
                  >
                    {showFullTimeForId === m.id
                      ? formatFullDateLabel(m.created_at)
                      : formatMessageTime(m.created_at)}
                  </time>
                  {isUser && receipt ? (
                    <WhatsAppTicks
                      status={receipt}
                      deliveredColor={theme === "dark" ? "#b8cfc4" : "#667781"}
                    />
                  ) : null}
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
              …
            </span>
            Listening…
          </div>
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}
