import React, { useCallback, useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

/** WhatsApp-style quick picks (commonly used + faces + reactions). */
const EMOJI_PICKER_ROWS = [
  ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "🥲", "😊", "😍", "🥰", "😘"],
  ["😢", "😭", "😤", "😠", "🤔", "😬", "🙄", "😌", "😴", "🤗", "🫂", "💭"],
  ["👍", "👎", "👏", "🙏", "🤝", "💪", "✌️", "🤞", "👋", "💛", "💙", "💜"],
  ["❤️", "🔥", "✨", "🌟", "💯", "🎉", "🌈", "☀️", "🌙", "⭐", "🫶", "💬"],
  ["🙂", "😉", "😎", "🥳", "🤩", "😇", "🫠", "🤷", "🙌", "👀", "💔", "🌿"],
];

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  replyTo,
  onCancelReply,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  const insertEmoji = useCallback(
    (emoji) => {
      const el = inputRef.current;
      if (!el) {
        onChange((value || "") + emoji);
        return;
      }
      const start = el.selectionStart ?? (value || "").length;
      const end = el.selectionEnd ?? start;
      const v = value || "";
      const next = v.slice(0, start) + emoji + v.slice(end);
      if (next.length > 4000) return;
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = Math.min(start + emoji.length, 4000);
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      });
    },
    [value, onChange],
  );

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white dark:border-wa-bar dark:bg-wa-header">
      {replyTo ? (
        <div className="flex items-start gap-2 border-b border-slate-100 px-3 py-2 dark:border-wa-bar/60">
          <div
            className="min-w-0 flex-1 border-l-4 border-emerald-500 pl-2 text-xs text-slate-600 dark:text-emerald-200/80"
            title={replyTo.content}
          >
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              {replyTo.sender === "user" ? "You" : "Reply"}
            </p>
            <p className="truncate text-slate-500 dark:text-wa-muted">
              {(replyTo.content || "").slice(0, 160)}
              {(replyTo.content || "").length > 160 ? "…" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-wa-bar"
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="relative flex items-center gap-1 px-2 py-2 md:gap-2 md:px-3">
        <div className="relative shrink-0" ref={wrapRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setPickerOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:text-emerald-200/70 dark:hover:bg-wa-bar"
            aria-label="Emoji"
            aria-expanded={pickerOpen}
          >
            <Smile className="h-6 w-6" strokeWidth={1.75} />
          </button>
          {pickerOpen ? (
            <div
              className="absolute bottom-full left-0 z-50 mb-2 w-[min(100vw-2rem,288px)] rounded-2xl border border-slate-200/90 bg-white p-2 shadow-xl dark:border-wa-bar dark:bg-wa-panel"
              role="dialog"
              aria-label="Emoji picker"
            >
              <div className="max-h-[220px] overflow-y-auto overscroll-contain pr-0.5">
                {EMOJI_PICKER_ROWS.map((row, ri) => (
                  <div key={ri} className="flex flex-wrap justify-start gap-0.5 py-0.5">
                    {row.map((emoji) => (
                      <button
                        key={`${ri}-${emoji}`}
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none hover:bg-slate-100 active:scale-95 dark:hover:bg-wa-bar"
                        onClick={() => {
                          insertEmoji(emoji);
                          setPickerOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={4000}
          placeholder={placeholder || "Type a message"}
          className="min-w-0 flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none ring-emerald-500/40 placeholder:text-slate-500 focus:ring-2 disabled:opacity-50 dark:bg-wa-bar dark:text-emerald-50 dark:placeholder:text-wa-muted"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="shrink-0 rounded-full bg-emerald-600 p-3 text-white hover:bg-emerald-700 disabled:opacity-40"
          aria-label="Send"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
