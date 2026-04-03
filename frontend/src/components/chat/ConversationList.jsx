import React, { useState } from "react";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onCreate,
  loading,
}) {
  const [q, setQ] = useState("");

  const filtered = conversations.filter((c) => {
    const preview = (c.last_message_preview || "").toLowerCase();
    const title = (c.title || "").toLowerCase();
    const s = q.toLowerCase();
    return !s || preview.includes(s) || title.includes(s);
  });

  return (
    <div className="flex min-h-0 w-full max-w-[360px] flex-1 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-wa-bar dark:bg-wa-panel md:h-full md:max-h-full md:min-h-0 md:flex-none">
      <div className="flex shrink-0 gap-2 border-b border-slate-200 p-3 dark:border-wa-bar">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats"
          className="flex-1 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900 outline-none ring-emerald-500/40 placeholder:text-slate-500 focus:ring-2 dark:bg-wa-bar dark:text-emerald-50 dark:placeholder:text-wa-muted"
        />
        <button
          type="button"
          onClick={onCreate}
          className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
        >
          New
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {loading && <p className="p-3 text-xs text-slate-500 dark:text-wa-muted">Loading…</p>}
        {!loading && filtered.length === 0 && (
          <p className="p-3 text-xs text-slate-500 dark:text-wa-muted">No chats yet.</p>
        )}
        <ul>
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 dark:border-wa-bar/60 dark:hover:bg-wa-header/80 ${
                  selectedId === c.id ? "bg-slate-100 dark:bg-wa-header" : ""
                }`}
              >
                <p className="truncate text-sm font-medium text-slate-900 dark:text-emerald-50">
                  {c.title || `Chat ${c.id}`}
                </p>
                {c.last_message_preview && (
                  <p className="truncate text-xs text-slate-500 dark:text-wa-muted">{c.last_message_preview}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
