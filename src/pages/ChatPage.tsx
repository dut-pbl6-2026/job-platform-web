import { DevTag, PageHead, TopBar } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ChatPage() {
  useDocumentTitle("Trợ lý AI");
  return (
    <>
      <TopBar />
      <main className="jp-page jp-page--narrow">
        <PageHead
          title={<>Trợ lý việc làm <DevTag /></>}
          lead="Gửi câu hỏi về tin tuyển dụng, CV hoặc nghề nghiệp. Cuộc trò chuyện được giữ theo từng phiên."
        />
        <ChatPanel variant="page" />
      </main>
    </>
  );
}
