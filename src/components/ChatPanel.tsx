import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Textarea } from "./ui";
import { useChat } from "../contexts/ChatContext";

const STARTERS = [
  "Gợi ý việc làm React tại Hà Nội",
  "Cách viết CV cho vị trí junior",
  "Mẹo phỏng vấn backend",
];

export function ChatPanel({ variant = "dock" }: { variant?: "dock" | "page" }) {
  const { messages, sending, notice, error, send, newSession, cancel } = useChat();
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
          <p>Nhớ các tin nhắn gần nhất trong phiên</p>
        </div>
        <div className="chat-head-actions">
          {sending && <Button variant="secondary" onClick={cancel}>Dừng</Button>}
          <Button variant="secondary" onClick={() => void newSession()}>Phiên mới</Button>
        </div>
      </header>

      <div className="chat-log" ref={scroller} role="log" aria-live="polite" aria-label="Cuộc trò chuyện">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Hỏi về việc làm, CV hoặc phỏng vấn. Khi dịch vụ AI chưa sẵn sàng, gợi ý tạm được lấy từ danh sách tin.</p>
            <div className="chat-starters">
              {STARTERS.map((s) => (
                <Button key={s} variant="secondary" onClick={() => void send(s)}>{s}</Button>
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

      {notice && <Alert tone="warning" className="chat-alert">{notice}</Alert>}
      {error && <Alert tone="error" className="chat-alert">{error}</Alert>}
      <p className="chat-disclaimer">Nội dung do AI tạo, hãy kiểm tra lại tin tuyển dụng.</p>

      <form className="chat-form" onSubmit={onSubmit}>
        <label className="jp-sr" htmlFor="chat-input">Tin nhắn</label>
        <Textarea
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
        <Button type="submit" disabled={sending || !draft.trim()}>Gửi</Button>
      </form>
    </div>
  );
}
