import i18n from "../i18n";

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
/** Shown when the conversation is longer than the context window; read through i18n when used. */
export function chatTruncationNotice(): string {
  return i18n.t("chat.truncation");
}
