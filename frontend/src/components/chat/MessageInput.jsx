import React from "react";

export default function MessageInput({ value, onChange, onSubmit, disabled, placeholder }) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 py-2 dark:border-wa-bar dark:bg-wa-header"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={4000}
        placeholder={placeholder || "Type a message"}
        className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none ring-emerald-500/40 placeholder:text-slate-500 focus:ring-2 disabled:opacity-50 dark:bg-wa-bar dark:text-emerald-50 dark:placeholder:text-wa-muted"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-full bg-emerald-600 p-3 text-white hover:bg-emerald-700 disabled:opacity-40"
        aria-label="Send"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
