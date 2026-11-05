import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { createChatSession, deleteChatSession, fetchChatHistory, sendChatMessage } from "../lib/chatApi";
import type { ChatJobHint, ChatMessage } from "../types/chat";
import { CHAT_TRUNCATION_NOTICE } from "../types/chat";

type ChatState = {
  open: boolean;
  messages: ChatMessage[];
  sessionId: string | null;
  sending: boolean;
  truncated: boolean;
  notice: string | null;
  error: string | null;
  setOpen: (open: boolean) => void;
  send: (text: string) => Promise<void>;
  newSession: () => Promise<void>;
  cancel: () => void;
};

const SESSION_KEY = "jp.ai.sessionId";
const Ctx = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [sending, setSending] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persistSession = useCallback((id: string | null) => {
    setSessionId(id);
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      abortRef.current?.abort();
      setMessages([]);
      setOpen(false);
      setSending(false);
      setTruncated(false);
      setNotice(null);
      setError(null);
      persistSession(null);
      return;
    }
    let cancelled = false;
    const existing = localStorage.getItem(SESSION_KEY);
    (async () => {
      try {
        const id = existing || await createChatSession(userId);
        if (cancelled) return;
        persistSession(id);
        const history = await fetchChatHistory(userId, id);
        if (!cancelled) setMessages(history);
      } catch {
        if (!cancelled) setError("Không tải được phiên chat.");
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, persistSession, userId]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !userId || sending) return;
    setError(null);
    setNotice(null);
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `asst-${Date.now()}`;
    setMessages((list) => [...list, userMsg, { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString() }]);
    setSending(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let jobs: ChatJobHint[] = [];
    try {
      const id = await sendChatMessage(userId, trimmed, sessionId || undefined, ac.signal, {
        onToken: (chunk) => {
          setMessages((list) => list.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk } : m));
        },
        onJobs: (next) => { jobs = next; },
        onTruncated: (msg) => {
          setTruncated(true);
          setNotice(msg || CHAT_TRUNCATION_NOTICE);
        },
        onDone: (sid) => persistSession(sid),
      });
      persistSession(id);
      setMessages((list) => list.map((m) => m.id === assistantId ? { ...m, jobs: jobs.length ? jobs : m.jobs } : m));
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        setMessages((list) => list.map((m) => m.id === assistantId && !m.content ? { ...m, content: "(đã dừng)" } : m));
      } else if ((e as { status?: number }).status === 429) {
        setError("Bạn đã gửi quá 20 câu trong một giờ. Thử lại sau.");
        setMessages((list) => list.filter((m) => m.id !== assistantId && m.id !== userMsg.id));
      } else {
        setError("Không gửi được tin. Kiểm tra đăng nhập hoặc thử lại.");
        setMessages((list) => list.filter((m) => m.id !== assistantId));
      }
    } finally {
      setSending(false);
    }
  }, [persistSession, sending, sessionId, userId]);

  const newSession = useCallback(async () => {
    if (!userId) return;
    abortRef.current?.abort();
    if (sessionId) {
      try { await deleteChatSession(userId, sessionId); } catch { /* ignore */ }
    }
    const id = await createChatSession(userId);
    persistSession(id);
    setMessages([]);
    setTruncated(false);
    setNotice(null);
    setError(null);
  }, [persistSession, sessionId, userId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const value = useMemo<ChatState>(() => ({
    open, messages, sessionId, sending, truncated, notice, error, setOpen, send, newSession, cancel,
  }), [open, messages, sessionId, sending, truncated, notice, error, send, newSession, cancel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useChat must be inside ChatProvider");
  return value;
}
