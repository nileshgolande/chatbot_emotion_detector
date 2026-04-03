import React from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

export default function ChatInterface({
  title,
  messages,
  msgLoading,
  input,
  onInput,
  onSend,
  onBack,
  showBack,
}) {
  const onSubmit = (e) => {
    e.preventDefault();
    onSend();
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-x-0 border-slate-200 bg-slate-50 dark:border-wa-bar/40 dark:bg-wa-bg md:border-x">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2 dark:border-wa-bar dark:bg-wa-header">
        {showBack && (
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-wa-bar md:hidden"
            onClick={onBack}
            aria-label="Back to list"
          >
            ←
          </button>
        )}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
          AI
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-emerald-50">{title}</p>
          <p className="text-xs text-slate-500 dark:text-wa-muted">Emotion-aware assistant</p>
        </div>
      </header>
      <MessageList messages={messages} loading={msgLoading} />
      <MessageInput
        value={input}
        onChange={onInput}
        onSubmit={onSubmit}
        disabled={msgLoading}
      />
    </div>
  );
}
