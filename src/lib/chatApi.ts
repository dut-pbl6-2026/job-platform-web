import { api, getAccessToken } from "./api";
import { API_BASE_URL } from "./config";
import { unwrap, pickStr } from "./http";
import { MOCK_JOBS } from "../mocks/jobsMock";
import type { ChatJobHint, ChatMessage } from "../types/chat";
import {
  CHAT_MAX_MESSAGES,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MAX_TOKENS,
  CHAT_RATE_PER_HOUR,
  CHAT_SESSION_TTL_MS,
  CHAT_TRUNCATION_NOTICE,
} from "../types/chat";

const STORE_KEY = "jp.mock.ai.chat";
const RATE_KEY = "jp.mock.ai.chat.rate";

export type ChatStreamHandlers = {
  onToken: (chunk: string) => void;
  onJobs?: (jobs: ChatJobHint[]) => void;
  onTruncated?: (notice: string) => void;
  onDone?: (sessionId: string) => void;
};

type StoredSession = {
  id: string;
  userId: string;
  updatedAt: number;
  messages: ChatMessage[];
};

type Store = { sessions: StoredSession[] };

function statusOf(e: unknown): number | undefined {
  return (e as { status?: number; response?: { status?: number } })?.status
    ?? (e as { response?: { status?: number } })?.response?.status;
}

function isOffline(e: unknown): boolean {
  const status = statusOf(e);
  return !status || status === 404 || status >= 500;
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* ignore */ }
  return { sessions: [] };
}

function saveStore(store: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function prune(store: Store, userId: string) {
  const cutoff = Date.now() - CHAT_SESSION_TTL_MS;
  store.sessions = store.sessions.filter((s) => s.userId !== userId || s.updatedAt >= cutoff);
}

function sessionOf(store: Store, userId: string, sessionId?: string | null) {
  prune(store, userId);
  let session = sessionId ? store.sessions.find((s) => s.id === sessionId && s.userId === userId) : undefined;
  if (!session) {
    session = { id: sessionId || uid(), userId, updatedAt: Date.now(), messages: [] };
    store.sessions.unshift(session);
  }
  session.updatedAt = Date.now();
  return session;
}

function trimContext(messages: ChatMessage[]) {
  let next = messages.slice(-CHAT_MAX_MESSAGES);
  let tokens = next.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  while (next.length > 2 && tokens > CHAT_MAX_TOKENS) {
    next = next.slice(1);
    tokens = next.reduce((sum, m) => sum + estimateTokens(m.content), 0);
  }
  return { messages: next, truncated: next.length < messages.length };
}

function checkRate(userId: string) {
  const now = Date.now();
  let hits: number[] = [];
  try {
    const raw = localStorage.getItem(`${RATE_KEY}.${userId}`);
    hits = raw ? (JSON.parse(raw) as number[]) : [];
  } catch { hits = []; }
  hits = hits.filter((t) => now - t < 60 * 60 * 1000);
  if (hits.length >= CHAT_RATE_PER_HOUR) {
    const err = new Error("Too many requests") as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  hits.push(now);
  localStorage.setItem(`${RATE_KEY}.${userId}`, JSON.stringify(hits));
}

function matchJobs(query: string): ChatJobHint[] {
  const q = query.toLowerCase();
  const tokens = q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const scored = MOCK_JOBS.map((job) => {
    const hay = `${job.title} ${job.company.name} ${job.location} ${job.category.name} ${(job.skills ?? []).join(" ")}`.toLowerCase();
    const hits = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    return { job, hits };
  }).filter((row) => row.hits > 0);
  scored.sort((a, b) => b.hits - a.hits);
  return scored.slice(0, 3).map(({ job }) => ({
    id: job.id,
    title: job.title,
    company: job.company.name,
  }));
}

function mockReply(message: string, jobs: ChatJobHint[]) {
  const lower = message.toLowerCase();
  const offTopic = /(hack|vũ khí|weapon|sex|nsfw)/i.test(lower);
  if (offTopic) {
    return "Mình chỉ hỗ trợ câu hỏi về việc làm, CV và nghề nghiệp. Hãy hỏi về vị trí, kỹ năng hoặc mẹo phỏng vấn nhé.";
  }
  const lines = [
    "Mình là trợ lý việc làm của Job Platform. Gợi ý dựa trên dữ liệu tin đăng (chế độ tạm khi AI-svc chưa sẵn sàng).",
  ];
  if (jobs.length) {
    lines.push("Một số tin phù hợp:");
    for (const job of jobs) lines.push(`- ${job.title} tại ${job.company}`);
    lines.push("Bạn có thể mở từng tin để xem mô tả và ứng tuyển.");
  } else if (/(cv|resume|hồ sơ)/i.test(lower)) {
    lines.push("CV nên nêu kỹ năng đúng JD, số liệu cụ thể, và 3–5 dòng tóm tắt mục tiêu. Nêu stack, năm kinh nghiệm và thành quả đo được.");
  } else if (/(phỏng vấn|interview)/i.test(lower)) {
    lines.push("Chuẩn bị STAR cho 3 dự án gần nhất, đọc JD để lấy từ khóa, và hỏi lại về team/oncall. Lương thảo luận sau khi hai bên hiểu scope.");
  } else {
    lines.push("Bạn có thể hỏi theo kỹ năng (React, kế toán…), địa điểm, hoặc mức lương. Mình sẽ gợi ý tin và mẹo CV.");
  }
  lines.push("Nội dung do AI tạo, hãy kiểm tra lại tin tuyển dụng trước khi ứng tuyển.");
  const text = lines.join("\n");
  return text.length > CHAT_MAX_OUTPUT_TOKENS * 4 ? text.slice(0, CHAT_MAX_OUTPUT_TOKENS * 4) : text;
}

async function streamText(text: string, signal: AbortSignal, onToken: (chunk: string) => void) {
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    onToken(part);
    await new Promise((r) => setTimeout(r, 12));
  }
}

function parseHistory(raw: unknown): ChatMessage[] {
  const body = unwrap<unknown>(raw);
  const list = Array.isArray(body) ? body : Array.isArray((body as { items?: unknown[] })?.items) ? (body as { items: unknown[] }).items : [];
  return list.map((item, i) => {
    const rec = (item ?? {}) as Record<string, unknown>;
    const roleRaw = (pickStr(rec, "role") || "assistant").toLowerCase();
    const role: ChatMessage["role"] = roleRaw === "user" ? "user" : roleRaw === "system" ? "system" : "assistant";
    return {
      id: pickStr(rec, "id") || `hist-${i}`,
      role,
      content: pickStr(rec, "content", "message", "text") || "",
      createdAt: pickStr(rec, "timestamp", "createdAt", "created_at") || new Date().toISOString(),
    };
  }).filter((m) => m.content);
}

export async function createChatSession(userId: string): Promise<string> {
  try {
    const { data } = await api.post("/ai/session");
    const body = unwrap<Record<string, unknown>>(data);
    const id = pickStr(body, "sessionId", "session_id", "id");
    if (id) return id;
  } catch (e) {
    if (!isOffline(e)) throw e;
  }
  const store = loadStore();
  const session = sessionOf(store, userId);
  saveStore(store);
  return session.id;
}

export async function deleteChatSession(userId: string, sessionId: string): Promise<void> {
  try {
    await api.delete(`/ai/session/${encodeURIComponent(sessionId)}`);
  } catch (e) {
    if (!isOffline(e)) throw e;
  }
  const store = loadStore();
  store.sessions = store.sessions.filter((s) => !(s.id === sessionId && s.userId === userId));
  saveStore(store);
}

export async function fetchChatHistory(userId: string, sessionId: string): Promise<ChatMessage[]> {
  try {
    const { data } = await api.get(`/ai/session/${encodeURIComponent(sessionId)}/history`);
    const items = parseHistory(data);
    if (items.length) return items;
  } catch (e) {
    if (!isOffline(e)) throw e;
  }
  const store = loadStore();
  return sessionOf(store, userId, sessionId).messages;
}

function consumeSseBlock(block: string, handlers: ChatStreamHandlers, acc: { sessionId?: string }) {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const data = dataLines.join("\n");
  if (!data) return;
  if (event === "token" || event === "delta" || event === "message") {
    try {
      const parsed = JSON.parse(data) as { token?: string; delta?: string; content?: string };
      handlers.onToken(parsed.token || parsed.delta || parsed.content || data);
    } catch {
      handlers.onToken(data);
    }
    return;
  }
  if (event === "jobs") {
    try {
      const jobs = JSON.parse(data) as ChatJobHint[];
      if (Array.isArray(jobs)) handlers.onJobs?.(jobs);
    } catch { /* ignore */ }
    return;
  }
  if (event === "truncated") {
    handlers.onTruncated?.(data || CHAT_TRUNCATION_NOTICE);
    return;
  }
  if (event === "done" || event === "end") {
    try {
      const parsed = JSON.parse(data) as { sessionId?: string; session_id?: string };
      acc.sessionId = parsed.sessionId || parsed.session_id || acc.sessionId;
    } catch {
      acc.sessionId = data || acc.sessionId;
    }
    if (acc.sessionId) handlers.onDone?.(acc.sessionId);
  }
}

async function streamFromApi(message: string, sessionId: string | undefined, signal: AbortSignal, handlers: ChatStreamHandlers) {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      sessionId,
      stream: true,
      maxTokens: CHAT_MAX_OUTPUT_TOKENS,
    }),
    signal,
  });
  if (res.status === 429) {
    const err = new Error("Too many requests") as Error & { status?: number };
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`Chat failed (${res.status})`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("text/event-stream")) {
    const raw = await res.json();
    const body = unwrap<Record<string, unknown>>(raw);
    const text = pickStr(body, "response", "content", "message") || "";
    const sid = pickStr(body, "sessionId", "session_id") || sessionId || uid();
    if (text) handlers.onToken(text);
    const jobs = body.jobs as ChatJobHint[] | undefined;
    if (Array.isArray(jobs)) handlers.onJobs?.(jobs);
    handlers.onDone?.(sid);
    return sid;
  }
  if (!res.body) throw new Error("Empty stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const acc: { sessionId?: string } = { sessionId };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) consumeSseBlock(part, handlers, acc);
  }
  if (buf.trim()) consumeSseBlock(buf, handlers, acc);
  const sid = acc.sessionId || sessionId || uid();
  handlers.onDone?.(sid);
  return sid;
}

export async function sendChatMessage(
  userId: string,
  message: string,
  sessionId: string | undefined,
  signal: AbortSignal,
  handlers: ChatStreamHandlers,
): Promise<string> {
  try {
    return await streamFromApi(message, sessionId, signal, handlers);
  } catch (e) {
    const status = statusOf(e);
    if (status === 401 || status === 403 || status === 429) throw e;
    if (!isOffline(e) && status && status < 500 && status !== 404) throw e;
  }

  checkRate(userId);
  const store = loadStore();
  const session = sessionOf(store, userId, sessionId);
  const userMsg: ChatMessage = { id: uid(), role: "user", content: message, createdAt: new Date().toISOString() };
  session.messages.push(userMsg);
  const trimmed = trimContext(session.messages);
  session.messages = trimmed.messages;
  if (trimmed.truncated) handlers.onTruncated?.(CHAT_TRUNCATION_NOTICE);
  const jobs = matchJobs(message);
  if (jobs.length) handlers.onJobs?.(jobs);
  const reply = mockReply(message, jobs);
  await streamText(reply, signal, handlers.onToken);
  const assistant: ChatMessage = {
    id: uid(),
    role: "assistant",
    content: reply,
    createdAt: new Date().toISOString(),
    jobs: jobs.length ? jobs : undefined,
  };
  session.messages.push(assistant);
  session.messages = trimContext(session.messages).messages;
  saveStore(store);
  handlers.onDone?.(session.id);
  return session.id;
}
