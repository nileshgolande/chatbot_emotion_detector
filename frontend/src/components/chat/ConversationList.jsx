import React, { useState } from "react";

function TrashIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onDelete,
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
            <li key={c.id} className="group border-b border-slate-100 dark:border-wa-bar/60">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={`min-w-0 flex-1 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-wa-header/80 ${
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
                {onDelete && (
                  <button
                    type="button"
                    title="Delete chat"
                    aria-label={`Delete ${c.title || `chat ${c.id}`}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (typeof onDelete === "function") onDelete(c.id);
                    }}
                    className="shrink-0 px-2 text-slate-400 opacity-70 transition hover:bg-red-500/10 hover:text-red-600 group-hover:opacity-100 dark:text-slate-500 dark:hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
