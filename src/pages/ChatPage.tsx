import { AppHeader } from "../components/AppHeader";
import { ChatPanel } from "../components/ChatPanel";

export default function ChatPage() {
  return (
    <>
      <AppHeader />
      <main className="container chat-page">
        <h1>Trợ lý việc làm</h1>
        <p className="hint">Chat có ngữ cảnh theo phiên (AI-01). Gửi câu hỏi về tin tuyển, CV hoặc nghề nghiệp.</p>
        <ChatPanel variant="page" />
      </main>
    </>
  );
}
