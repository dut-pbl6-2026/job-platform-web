import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { InterviewCalendar } from "../components/InterviewCalendar";
import { Alert, Button, PageHead, SkeletonBlock } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { downloadInterviewIcs, listInterviews, type Interview } from "../lib/engagementApi";
import { loadErrorMessage } from "../lib/http";
import { showToast } from "../lib/toastBus";

/** The candidate's interview calendar: invites the recruiter sent, with the .ics to add to their own. */
export default function InterviewsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("interviews.documentTitle"));

  const interviews = useQuery({
    queryKey: ["candidate", "interviews"],
    queryFn: () => listInterviews(),
    staleTime: 30_000,
  });

  function download(interview: Interview) {
    downloadInterviewIcs(interview).catch(() => showToast({ title: t("interviews.downloadFailed"), kind: "error" }));
  }

  return (
    <main className="jp-page">
      <PageHead title={t("interviews.title")} lead={t("interviews.lead")} />
      {interviews.isPending && <SkeletonBlock height={380} label={t("interviews.loading")} />}
      {interviews.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={interviews.isFetching} onClick={() => void interviews.refetch()}>
              {t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(interviews.error, t("interviews.loadWhat"))}
        </Alert>
      )}
      {interviews.data && <InterviewCalendar interviews={interviews.data} viewer="candidate" onDownload={download} />}
    </main>
  );
}
