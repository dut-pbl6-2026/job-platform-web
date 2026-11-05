export type ChatRole = "user" | "assistant" | "system";

export type ChatJobHint = {
  id: string;
  title: string;
  company: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  jobs?: ChatJobHint[];
};

export const CHAT_MAX_MESSAGES = 20;
export const CHAT_MAX_TOKENS = 8000;
export const CHAT_MAX_OUTPUT_TOKENS = 512;
export const CHAT_RATE_PER_HOUR = 20;
export const CHAT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const CHAT_TRUNCATION_NOTICE =
  "Hội thoại đã dài, tôi sẽ chỉ nhớ 20 tin nhắn gần nhất. Bạn có thể bắt đầu phiên mới.";
