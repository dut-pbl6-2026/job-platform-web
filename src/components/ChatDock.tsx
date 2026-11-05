import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { ChatPanel } from "./ChatPanel";

export function ChatDock() {
  const { isAuthenticated } = useAuth();
  const { open, setOpen } = useChat();
  if (!isAuthenticated) return null;

  return (
    <div className="chat-dock">
      {open && (
        <div className="chat-dock-panel" role="dialog" aria-label="Trợ lý việc làm">
          <ChatPanel />
          <div className="chat-dock-links">
            <Link to="/chat" onClick={() => setOpen(false)}>Mở trang chat</Link>
            <button type="button" onClick={() => setOpen(false)}>Thu nhỏ</button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="chat-fab"
        aria-expanded={open}
        aria-label="Mở trợ lý việc làm"
        onClick={() => setOpen(!open)}
      >
        AI
      </button>
    </div>
  );
}
