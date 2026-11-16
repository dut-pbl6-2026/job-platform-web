import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { InterviewCalendar } from "../components/InterviewCalendar";
import { Alert, Button, Modal, SkeletonBlock } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { cancelInterview, downloadInterviewIcs, listInterviews, type Interview } from "../lib/engagementApi";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { showToast } from "../lib/toastBus";

/** Every interview this recruiter scheduled, on a month grid with its .ics download and cancel action. */
export default function RecruiterInterviewsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("recruiter.documentTitles.interviews"));
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState<Interview | null>(null);

  const interviews = useQuery({
    queryKey: ["recruiter", "interviews"],
    queryFn: () => listInterviews(),
    staleTime: 30_000,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelInterview(id, true),
    onSuccess: (result) => {
      showToast({
        title: result.inviteSent
          ? t("recruiter.interview.cancelledAndMailed")
          : t("recruiter.interview.cancelledNoMail"),
        kind: result.inviteSent ? "success" : "warning",
      });
      setCancelling(null);
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "interviews"] });
    },
    onError: (error: unknown) =>
      showToast({ title: apiErrorMessage(error, t("recruiter.interview.cancelFailed")), kind: "error" }),
  });

  function download(interview: Interview) {
    downloadInterviewIcs(interview).catch(() => showToast({ title: t("interviews.downloadFailed"), kind: "error" }));
  }

  return (
    <RecruiterShell title={t("recruiter.interviews.title")} lead={t("recruiter.interviews.lead")}>
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
      {interviews.data && (
        <InterviewCalendar
          interviews={interviews.data}
          viewer="recruiter"
          onCancel={setCancelling}
          onDownload={download}
          cancellingId={cancel.isPending ? (cancel.variables ?? null) : null}
        />
      )}

      <Modal
        open={Boolean(cancelling)}
        title={t("recruiter.interview.cancelTitle")}
        onClose={() => setCancelling(null)}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCancelling(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancelling && cancel.mutate(cancelling.id)}
            >
              {t("recruiter.interview.cancelConfirm")}
            </Button>
          </>
        }
      >
        <p>
          {t("recruiter.interview.cancelBody", {
            job: cancelling?.jobTitle ?? "",
            name: cancelling?.applicantName ?? cancelling?.applicantEmail ?? "",
          })}
        </p>
      </Modal>
    </RecruiterShell>
  );
}
