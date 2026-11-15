import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useChat } from "../contexts/ChatContext";
import { ChatPanel } from "./ChatPanel";

export function ChatDock() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { open, setOpen } = useChat();
  if (!isAuthenticated) return null;

  return (
    <div className="chat-dock">
      {open && (
        <div className="chat-dock-panel" role="dialog" aria-label={t("chat.dockLabel")}>
          <ChatPanel />
          <div className="chat-dock-links">
            <Link to="/chat" onClick={() => setOpen(false)}>
              {t("chat.dockPage")}
            </Link>
            <button type="button" onClick={() => setOpen(false)}>
              {t("chat.dockCollapse")}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="chat-fab"
        aria-expanded={open}
        aria-label={t("chat.dockOpen")}
        onClick={() => setOpen(!open)}
      >
        AI
      </button>
    </div>
  );
}
