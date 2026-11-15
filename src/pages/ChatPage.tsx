import { useTranslation } from "react-i18next";
import { DevTag, PageHead, TopBar } from "../components/ui";
import { ChatPanel } from "../components/ChatPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ChatPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("nav.aiAssistant"));
  return (
    <>
      <TopBar />
      <main className="jp-page jp-page--narrow">
        <PageHead
          title={
            <>
              {t("chat.title")} <DevTag />
            </>
          }
          lead={t("chat.pageLead")}
        />
        <ChatPanel variant="page" />
      </main>
    </>
  );
}
