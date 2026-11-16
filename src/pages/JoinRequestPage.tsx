import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  PageHead,
  Panel,
  SkeletonBlock,
  StatusMark,
  TopBar,
  type StatusTone,
} from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate, formatDateTime } from "../lib/dates";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { escalateMyJoinRequest, fetchMyJoinRequest, type JoinRequestStatus } from "../lib/joinRequestApi";
import { showToast } from "../lib/toastBus";

const STATUS_TONE: Record<JoinRequestStatus, StatusTone> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  Expired: "neutral",
  Escalated: "info",
  SupportApproved: "success",
  SupportRejected: "danger",
};

const STATUS_KEY = {
  Pending: "joinRequest.status.pending",
  Approved: "joinRequest.status.approved",
  Rejected: "joinRequest.status.rejected",
  Expired: "joinRequest.status.expired",
  Escalated: "joinRequest.status.escalated",
  SupportApproved: "joinRequest.status.supportApproved",
  SupportRejected: "joinRequest.status.supportRejected",
} as const satisfies Record<JoinRequestStatus, string>;

const NOTE_KEY = {
  Pending: "joinRequest.mine.note.pending",
  Approved: "joinRequest.mine.note.approved",
  Rejected: "joinRequest.mine.note.rejected",
  Expired: "joinRequest.mine.note.expired",
  Escalated: "joinRequest.mine.note.escalated",
  SupportApproved: "joinRequest.mine.note.supportApproved",
  SupportRejected: "joinRequest.mine.note.supportRejected",
} as const satisfies Record<JoinRequestStatus, string>;

/**
 * Requester side of a Company join request (SRS AUTH-01-12 to AUTH-01-14). A work-email sign-up
 * routed to an existing Company creates one for the account, which stays a User until the Company
 * admin approves. The client shows the status the server returns, including the waiting period, and
 * offers escalation only when `canEscalate` is true (the server allows it once, after expiry).
 */
export default function JoinRequestPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("joinRequest.mine.documentTitle"));
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["join-request", "me"],
    queryFn: fetchMyJoinRequest,
    // A 404 is the normal "this account has no request" answer, not a transient failure.
    retry: false,
    staleTime: 0,
  });

  const escalate = useMutation({
    mutationFn: escalateMyJoinRequest,
    onSuccess: () => {
      showToast({ title: t("joinRequest.mine.escalated"), kind: "success" });
      void queryClient.invalidateQueries({ queryKey: ["join-request", "me"] });
    },
    onError: (error) => {
      // 409: the waiting period or another escalation changed the state; resync with the server.
      if (httpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: ["join-request", "me"] });
    },
  });

  const notFound = httpStatus(query.error) === 404;
  const request = query.data;
  const escalateError = escalate.isError
    ? httpStatus(escalate.error) === 409
      ? t("joinRequest.mine.stateChanged")
      : apiErrorMessage(escalate.error, t("joinRequest.mine.escalateFailed"))
    : null;

  return (
    <>
      <TopBar />
      <main className="jp-page">
        <PageHead title={t("joinRequest.mine.title")} lead={t("joinRequest.mine.lead")} />

        {query.isPending && <SkeletonBlock height={200} label={t("joinRequest.mine.loading")} />}

        {query.isError && !notFound && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
                {query.isFetching ? t("jobs.retrying") : t("jobs.retry")}
              </Button>
            }
          >
            {loadErrorMessage(query.error, t("joinRequest.mine.loadWhat"))}
          </Alert>
        )}

        {notFound && (
          <EmptyState
            title={t("joinRequest.mine.emptyTitle")}
            action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
          >
            {t("joinRequest.mine.emptyText")}
          </EmptyState>
        )}

        {request && (
          <Panel title={t("joinRequest.mine.panelTitle")}>
            <dl className="jp-kv">
              <div>
                <dt>{t("joinRequest.mine.statusLabel")}</dt>
                <dd>
                  <StatusMark tone={STATUS_TONE[request.status]}>{t(STATUS_KEY[request.status])}</StatusMark>
                </dd>
              </div>
              <div>
                <dt>{t("joinRequest.mine.sentLabel")}</dt>
                <dd>{formatDateTime(request.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("joinRequest.mine.expiresLabel")}</dt>
                <dd>{formatDate(request.expiresAt)}</dd>
              </div>
            </dl>

            <p className="jp-join-request-note">
              {t(NOTE_KEY[request.status], { date: formatDate(request.expiresAt) })}
            </p>

            {escalateError && <Alert tone="error">{escalateError}</Alert>}

            {request.canEscalate && (
              <div className="jp-join-request-escalate">
                <p className="jp-hint">{t("joinRequest.mine.escalateHint")}</p>
                <Button loading={escalate.isPending} onClick={() => escalate.mutate()}>
                  {escalate.isPending ? t("joinRequest.mine.escalating") : t("joinRequest.mine.escalate")}
                </Button>
              </div>
            )}

            {request.status === "Escalated" && <p className="jp-hint">{t("joinRequest.mine.supportNote")}</p>}
          </Panel>
        )}
      </main>
    </>
  );
}
