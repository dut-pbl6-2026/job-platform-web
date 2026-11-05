import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useChat } from "../contexts/ChatContext";

const STARTERS = [
  "Gợi ý việc làm React tại Hà Nội",
  "Cách viết CV cho vị trí junior",
  "Mẹo phỏng vấn backend",
];

export function ChatPanel({ variant = "dock" }: { variant?: "dock" | "page" }) {
  const { messages, sending, notice, error, truncated, send, newSession, cancel } = useChat();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
          <strong>Trợ lý việc làm</strong>
          <p>AI-01 · ngữ cảnh 20 tin / 8.000 token</p>
        </div>
        <div className="chat-head-actions">
          {sending && <button type="button" className="btn-topcv-outline" onClick={cancel}>Dừng</button>}
          <button type="button" className="btn-topcv-muted" onClick={() => void newSession()}>Phiên mới</button>
        </div>
      </header>

      <div className="chat-log" ref={scroller} role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Hỏi về việc làm, CV hoặc phỏng vấn. Khi AI-svc chưa chạy, mình dùng gợi ý tạm từ danh sách tin.</p>
            <div className="chat-starters">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)}>{s}</button>
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

      {(notice || truncated) && <div className="chat-notice">{notice}</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <p className="chat-disclaimer">Nội dung do AI tạo, hãy kiểm tra lại tin tuyển dụng.</p>

      <form className="chat-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="chat-input">Tin nhắn</label>
        <textarea
          id="chat-input"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Hỏi về việc làm, CV, lương…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <button className="btn-topcv-fill" type="submit" disabled={sending || !draft.trim()}>Gửi</button>
      </form>
    </div>
  );
}
