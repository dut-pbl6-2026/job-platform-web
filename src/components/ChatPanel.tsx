import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert, Button, Textarea } from "./ui";
import { useChat } from "../contexts/ChatContext";

const STARTER_KEYS = ["chat.starters.react", "chat.starters.cv", "chat.starters.interview"] as const;

export function ChatPanel({ variant = "dock" }: { variant?: "dock" | "page" }) {
  const { t } = useTranslation();
  const { messages, sending, notice, error, send, newSession, cancel } = useChat();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Nothing to scroll to until the first message or a pending reply.
    if (messages.length === 0 && !sending) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void send(text);
  }

  return (
    <div className={`chat-panel chat-panel--${variant}`}>
      <header className="chat-head">
        <div>
          <strong>{t("chat.title")}</strong>
          <p>{t("chat.remember")}</p>
        </div>
        <div className="chat-head-actions">
          {sending && (
            <Button variant="secondary" onClick={cancel}>
              {t("chat.stop")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void newSession()}>
            {t("chat.newSession")}
          </Button>
        </div>
      </header>

      <div className="chat-log" ref={scroller} role="log" aria-live="polite" aria-label={t("chat.logLabel")}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>{t("chat.intro")}</p>
            <div className="chat-starters">
              {STARTER_KEYS.map((key) => (
                <Button key={key} variant="secondary" onClick={() => void send(t(key))}>
                  {t(key)}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <article key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
            <p>{m.content || (m.role === "assistant" && sending ? "…" : "")}</p>
            {m.jobs?.length ? (
              <ul className="chat-jobs">
                {m.jobs.map((job) => (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                    <span>{job.company}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>

      {notice && (
        <Alert tone="warning" className="chat-alert">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="chat-alert">
          {error}
        </Alert>
      )}
      <p className="chat-disclaimer">{t("chat.disclaimer")}</p>

      <form className="chat-form" onSubmit={onSubmit}>
        <label className="jp-sr" htmlFor="chat-input">
          {t("chat.inputLabel")}
        </label>
        <Textarea
          id="chat-input"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chat.inputPlaceholder")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={sending || !draft.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </div>
  );
}
