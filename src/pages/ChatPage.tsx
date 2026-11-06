import { TopBar } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ChatPage() {
  useDocumentTitle("Trợ lý AI");
  return (
    <>
      <TopBar />
      <main className="container chat-page">
        <h1>Trợ lý việc làm</h1>
        <p className="hint">Chat có ngữ cảnh theo phiên (AI-01). Gửi câu hỏi về tin tuyển, CV hoặc nghề nghiệp.</p>
        <ChatPanel variant="page" />
      </main>
    </>
  );
}
