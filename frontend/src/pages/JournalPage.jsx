import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import api from "../services/api";

const MOODS = ["happy", "sad", "anxious", "angry", "neutral"];

export default function JournalPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    mood_at_entry: "neutral",
  });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.get("/api/journal/entries/");
      const list = Array.isArray(data) ? data : data.results || [];
      setEntries(list);
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to load entries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post("/api/journal/entries/", {
        title: form.title.trim() || "Untitled",
        content: form.content.trim(),
        mood_at_entry: form.mood_at_entry,
        tags: [],
      });
      setEntries((prev) => [data, ...prev]);
      setForm({ title: "", content: "", mood_at_entry: "neutral" });
    } catch (err) {
      const d = err.response?.data;
      setError(typeof d === "object" ? JSON.stringify(d) : err.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const generateInsights = async (id) => {
    setError(null);
    try {
      const { data } = await api.post(`/api/journal/entries/${id}/generate_insights/`);
      setEntries((prev) => prev.map((x) => (x.id === id ? data : x)));
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Insights failed.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold">Journal</h1>
        <p className="mb-6 text-sm text-wa-muted">
          Private entries stored via <code className="rounded bg-wa-bar px-1">/api/journal/entries/</code>.
          Generate AI reflections when an API key is configured on the server.
        </p>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <form
          onSubmit={onSubmit}
          className="mb-10 space-y-3 rounded-xl border border-wa-bar bg-wa-panel p-4"
        >
          <h2 className="text-lg font-medium">New entry</h2>
          <div>
            <label className="mb-1 block text-xs text-wa-muted">Title</label>
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm outline-none ring-wa-accent focus:ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-wa-muted">Mood</label>
            <select
              name="mood_at_entry"
              value={form.mood_at_entry}
              onChange={onChange}
              className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm outline-none ring-wa-accent focus:ring"
            >
              {MOODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-wa-muted">Content</label>
            <textarea
              name="content"
              value={form.content}
              onChange={onChange}
              rows={5}
              required
              className="w-full rounded-md bg-wa-bar px-3 py-2 text-sm outline-none ring-wa-accent focus:ring"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-wa-accent px-4 py-2 text-sm font-medium text-emerald-950 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save entry"}
          </button>
        </form>

        <h2 className="mb-3 text-lg font-medium">Your entries</h2>
        {loading && <p className="text-wa-muted">Loading…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-wa-muted">No entries yet. Write something above.</p>
        )}
        <ul className="space-y-4">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-wa-bar bg-wa-panel p-4 text-sm"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.title}</span>
                <span className="text-xs capitalize text-wa-muted">{e.mood_at_entry}</span>
              </div>
              <p className="mb-2 whitespace-pre-wrap text-wa-muted">{e.content}</p>
              {e.ai_insights && (
                <div className="mb-2 rounded-md bg-wa-bar/50 p-2 text-xs text-emerald-100">
                  <span className="font-semibold text-emerald-300">Insights: </span>
                  {e.ai_insights}
                </div>
              )}
              <button
                type="button"
                onClick={() => generateInsights(e.id)}
                className="text-xs text-wa-accent underline"
              >
                Generate AI insights
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-8">
          <Link to="/chat" className="text-wa-accent underline">
            Back to chat
          </Link>
        </p>
      </main>
    </div>
  );
}
