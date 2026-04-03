import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import ConversationList from "../components/chat/ConversationList";
import ChatInterface from "../components/chat/ChatInterface";
import { useAuth } from "../hooks/useAuth";

const DEMO_CONVERSATIONS = [
  { id: 1, title: "Welcome", last_message_preview: "Try the WhatsApp-style background" },
];

const DEMO_MESSAGES = [
  {
    id: 1,
    sender: "bot",
    content:
      "Hi there 💛 — welcome to demo mode! ✨ Your chat has the cozy wallpaper and bubbles we designed. I'm glad you're here 🫧 Whenever you're ready, say what's on your mind.",
    created_at: new Date().toISOString(),
  },
];

export default function ChatPage() {
  const { user } = useAuth();
  const isDemo = user?.is_demo || localStorage.getItem("chat_demo") === "1";

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState("");
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
      if (list.length) setSelectedId((id) => id ?? list[0].id);
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

  const loadMessages = useCallback(async () => {
    if (!selectedId) {
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
    } catch {
      setMessages(isDemo ? DEMO_MESSAGES : []);
    } finally {
      setMsgLoading(false);
    }
  }, [selectedId, isDemo]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const createChat = async () => {
    if (isDemo) {
      const id = Date.now();
      setConversations((c) => [
        { id, title: "New chat", last_message_preview: "" },
        ...c,
      ]);
      setSelectedId(id);
      setMessages([]);
      return;
    }
    try {
      const { data } = await api.post("/api/chat/conversations/", { title: "" });
      setConversations((c) => [data, ...c]);
      setSelectedId(data.id);
      setMessages([]);
    } catch {
      const id = Date.now();
      setConversations((c) => [{ id, title: "New chat (offline)", last_message_preview: "" }, ...c]);
      setSelectedId(id);
      setMessages([]);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!selectedId || !text) return;
    setInput("");
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    if (isDemo) {
      setMsgLoading(true);
      const demoEmotion = (() => {
        const t = text.toLowerCase();
        if (/\b(sad|cry|depressed|hurt)\b/.test(t)) return "sad";
        if (/\b(happy|great|love|thanks)\b/.test(t)) return "happy";
        if (/\b(angry|furious|hate)\b/.test(t)) return "angry";
        if (/\b(worried|anxious|stress)\b/.test(t)) return "anxious";
        return "neutral";
      })();
      setTimeout(() => {
        const uid = Date.now();
        setMessages((m) => [
          ...m.filter((x) => x.id !== optimistic.id),
          {
            ...optimistic,
            id: uid,
            emotion: {
              primary_emotion: demoEmotion,
              confidence: 0.75,
              emotion_scores: { [demoEmotion]: 0.75, neutral: 0.25 },
            },
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
      const { data } = await api.post(`/api/chat/conversations/${selectedId}/send_message/`, {
        content: text,
      });
      const list = Array.isArray(data) ? data : data.results || [];
      setMessages(list);
      const last = list[list.length - 1];
      const preview = (last && last.content ? String(last.content) : "").slice(0, 120);
      if (preview) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, last_message_preview: preview } : c)),
        );
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
    } finally {
      setMsgLoading(false);
    }
  };

  const active = conversations.find((c) => c.id === selectedId);
  const title = active?.title || "Chat";

  const showList = !isMobile || mobileMode === "list";
  const showChat = !isMobile || mobileMode === "chat";

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-wa-bg dark:text-emerald-50">
      <Navbar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {showList && (
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              if (isMobile) setMobileMode("chat");
            }}
            onCreate={createChat}
            loading={loading}
          />
        )}
        {showChat && (
          <ChatInterface
            title={title}
            messages={messages}
            msgLoading={msgLoading}
            input={input}
            onInput={setInput}
            onSend={send}
            showBack={isMobile}
            onBack={() => setMobileMode("list")}
          />
        )}
      </div>
    </div>
  );
}
