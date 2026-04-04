import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ConversationList from "../components/chat/ConversationList";
import ChatInterface from "../components/chat/ChatInterface";
import { useAuth } from "../hooks/useAuth";
import { greetingName as displayGreetingName } from "../utils/greetingName";

const isDraftConversationId = (id) => id != null && String(id).startsWith("local-new-");

/** Same copy as server `chat.signals.WELCOME_BOT_MESSAGE` — sidebar preview starts with “Try the WhatsApp-style background”. */
const WELCOME_BOT_CONTENT =
  "Try the WhatsApp-style background — Hi there 💛, welcome! ✨ I'm glad you're here 🫧 Say what's on your mind when you're ready.";

/** Pin “Welcome” first; then newest by created_at. */
function sortConversationsForDisplay(list) {
  const isWelcome = (c) => (c.title || "").trim().toLowerCase() === "welcome";
  return [...list].sort((a, b) => {
    if (isWelcome(a) && !isWelcome(b)) return -1;
    if (!isWelcome(a) && isWelcome(b)) return 1;
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return tb - ta;
  });
}

/** WhatsApp-style: include quoted context for the model (not shown as a separate UI quote in history on server). */
function buildMessageWithReply(rawText, replyTo) {
  const text = (rawText || "").trim();
  if (!text) return "";
  if (!replyTo || !(replyTo.content || "").trim()) return text;
  const q = (replyTo.content || "").trim().replace(/\s+/g, " ").slice(0, 220);
  const who = replyTo.sender === "bot" ? "them" : "your earlier message";
  return `[Replying to ${who}: "${q}"]\n${text}`;
}

function previewFromMessageBody(text) {
  const t = text || "";
  return t.length > 120 ? `${t.slice(0, 119)}…` : t;
}

const DEMO_CONVERSATIONS = [
  {
    id: 1,
    title: "Welcome",
    last_message_preview: previewFromMessageBody(WELCOME_BOT_CONTENT),
    created_at: new Date().toISOString(),
  },
];

const DEMO_MESSAGES = [
  {
    id: 1,
    sender: "bot",
    content: WELCOME_BOT_CONTENT,
    created_at: new Date().toISOString(),
  },
];

export default function ChatPage() {
  const { user, loading: authLoading, enableDemoUser } = useAuth();
  const isDemo = user?.is_demo || localStorage.getItem("chat_demo") === "1";

  // First-time visitors: no account yet — open chat in demo immediately (local replies until they sign up).
  useEffect(() => {
    if (authLoading) return;
    if (localStorage.getItem("access")) return;
    enableDemoUser();
  }, [authLoading, enableDemoUser]);

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false,
  );
  const [mobileMode, setMobileMode] = useState("list");

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setMobileMode(selectedId ? "chat" : "list");
  }, [isMobile, selectedId]);

  useEffect(() => {
    setReplyTo(null);
  }, [selectedId]);

  const loadConversations = useCallback(async () => {
    if (isDemo) {
      setConversations(DEMO_CONVERSATIONS);
      setSelectedId((id) => (id == null ? 1 : id));
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/api/chat/conversations/");
      const list = Array.isArray(data) ? data : data.results || [];
      setConversations(list);
      setSendError(null);
      setSelectedId((prev) => {
        if (!list.length) return null;
        const sorted = sortConversationsForDisplay(list);
        if (prev != null && (isDraftConversationId(prev) || sorted.some((c) => c.id === prev))) {
          return prev;
        }
        return sorted[0].id;
      });
    } catch {
      setConversations(DEMO_CONVERSATIONS);
      setSelectedId((id) => id ?? 1);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const deleteChat = useCallback(
    async (id) => {
      const ok =
        typeof window === "undefined"
          ? true
          : window.confirm("Delete this chat and all its messages? This cannot be undone.");
      if (!ok) return;

      if (isDemo) {
        setConversations((prev) => {
          const next = prev.filter((c) => c.id !== id);
          setSelectedId((sid) => (sid === id ? next[0]?.id ?? null : sid));
          return next;
        });
        return;
      }
      if (isDraftConversationId(id)) {
        setConversations((prev) => {
          const next = prev.filter((c) => c.id !== id);
          setSelectedId((sid) => (sid === id ? next[0]?.id ?? null : sid));
          return next;
        });
        return;
      }
      try {
        await api.delete(`/api/chat/conversations/${id}/`);
        setConversations((prev) => {
          const next = prev.filter((c) => c.id !== id);
          setSelectedId((sid) => (sid === id ? next[0]?.id ?? null : sid));
          return next;
        });
      } catch (err) {
        const detail =
          err.response?.data?.detail ||
          (typeof err.response?.data === "string" ? err.response.data : null) ||
          err.message ||
          "Could not delete chat.";
        console.error("delete conversation failed", err.response?.status, err.response?.data);
        window.alert(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
    },
    [isDemo],
  );

  const loadMessages = useCallback(async () => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    if (!isDemo && isDraftConversationId(selectedId)) {
      setMessages([]);
      return;
    }
    if (isDemo) {
      setMessages(DEMO_MESSAGES);
      return;
    }
    setMsgLoading(true);
    try {
      const { data } = await api.get(`/api/chat/conversations/${selectedId}/messages/`);
      const list = Array.isArray(data) ? data : data.results || [];
      setMessages(list);
    } catch (err) {
      if (!isDemo && err.response?.status === 404) {
        setMessages([]);
        loadConversations();
        return;
      }
      setMessages(isDemo ? DEMO_MESSAGES : []);
    } finally {
      setMsgLoading(false);
    }
  }, [selectedId, isDemo, loadConversations]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const createChat = async () => {
    if (isDemo) {
      const id = Date.now();
      const now = new Date().toISOString();
      setConversations((c) => [
        { id, title: "New chat", last_message_preview: "", created_at: now },
        ...c,
      ]);
      setSelectedId(id);
      setMessages([]);
      return;
    }
    // Local draft only — server conversation is created on first send (one round-trip).
    const id = `local-new-${Date.now()}`;
    const now = new Date().toISOString();
    setConversations((c) => [
      { id, title: "New chat", last_message_preview: "", created_at: now },
      ...c,
    ]);
    setSelectedId(id);
    setMessages([]);
  };

  const send = async () => {
    const text = input.trim();
    if (!selectedId || !text) return;
    const outgoing = buildMessageWithReply(text, replyTo);
    setSendError(null);
    setInput("");
    setReplyTo(null);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender: "user",
      content: outgoing,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    if (isDemo) {
      setMsgLoading(true);
      setTimeout(() => {
        const uid = Date.now();
        const titleFromFirst =
          outgoing.length > 120 ? `${outgoing.slice(0, 119)}…` : outgoing;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId && (!c.title || c.title === "New chat")
              ? { ...c, title: titleFromFirst }
              : c,
          ),
        );
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          {
            ...optimistic,
            id: uid,
          },
          {
            id: uid + 1,
            sender: "bot",
            content:
              "I hear you 💙 — in demo mode I'm just local, but I'm still cheering you on. ✨ Register and connect the API for real emotion-aware replies with the full empathic model 🫂",
            created_at: new Date().toISOString(),
          },
        ]);
        setMsgLoading(false);
      }, 400);
      return;
    }

    setMsgLoading(true);
    try {
      const draft = isDraftConversationId(selectedId);
      const { data } = draft
        ? await api.post("/api/chat/conversations/", { title: "", first_message: outgoing })
        : await api.post(`/api/chat/conversations/${selectedId}/send_message/`, {
            content: outgoing,
          });
      const list = Array.isArray(data?.messages)
        ? data.messages
        : Array.isArray(data)
          ? data
          : data?.results || [];
      setMessages(list);
      const last = list[list.length - 1];
      const preview = (last && last.content ? String(last.content) : "").slice(0, 120);
      const convPatch = data?.conversation;
      const resolvedId = convPatch?.id ?? selectedId;
      if (draft && convPatch) {
        setSelectedId(resolvedId);
      }
      if (preview || convPatch) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== selectedId) return c;
            const next = { ...c, ...(convPatch || {}) };
            if (convPatch?.id != null) next.id = convPatch.id;
            if (preview) next.last_message_preview = preview;
            if (convPatch?.title != null) next.title = convPatch.title;
            if (convPatch?.last_message_preview != null)
              next.last_message_preview = convPatch.last_message_preview;
            return next;
          }),
        );
      }
    } catch (err) {
      const status = err.response?.status;
      const detail =
        err.response?.data?.detail ||
        (typeof err.response?.data === "string" ? err.response.data : null) ||
        err.message ||
        "Request failed";
      console.error("send_message failed", status, err.response?.data);
      if (status === 404) {
        loadConversations();
        setSendError("That conversation is gone or unavailable. Your chat list was refreshed — pick a chat and try again.");
      } else {
        setSendError(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setMsgLoading(false);
    }
  };

  const displayConversations = useMemo(
    () => sortConversationsForDisplay(conversations),
    [conversations],
  );
  const active = displayConversations.find((c) => c.id === selectedId);
  const title = active?.title || "Chat";

  const showList = !isMobile || mobileMode === "list";
  const showChat = !isMobile || mobileMode === "chat";
  const greet = displayGreetingName(user);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      {isDemo && (
        <div
          className="shrink-0 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-950 dark:text-amber-100"
          role="status"
        >
          Demo mode: replies are local only.{" "}
          <Link to="/login" className="underline font-semibold">
            Log in
          </Link>{" "}
          for real API + AI responses.
        </div>
      )}
      {sendError && !isDemo && (
        <div
          className="shrink-0 border-b border-red-500/40 bg-red-500/10 px-4 py-2 text-center text-xs text-red-800 dark:text-red-200"
          role="alert"
        >
          {sendError}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {showList && (
          <ConversationList
            conversations={displayConversations}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              if (isMobile) setMobileMode("chat");
            }}
            onDelete={deleteChat}
            onCreate={createChat}
            loading={loading}
          />
        )}
        {showChat && (
          <ChatInterface
            title={title}
            greetingName={user ? greet : undefined}
            messages={messages}
            msgLoading={msgLoading}
            input={input}
            onInput={(v) => {
              setInput(v);
              if (sendError) setSendError(null);
            }}
            onSend={send}
            showBack={isMobile}
            onBack={() => setMobileMode("list")}
            replyTo={replyTo}
            onReply={setReplyTo}
            onCancelReply={() => setReplyTo(null)}
          />
        )}
      </div>
    </div>
  );
}
