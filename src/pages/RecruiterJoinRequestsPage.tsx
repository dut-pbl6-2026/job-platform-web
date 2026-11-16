import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, EmptyState, Pagination, SkeletonRows, StatusMark, type StatusTone } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate, formatDateTime } from "../lib/dates";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import {
  approveJoinRequest,
  fetchJoinRequests,
  rejectJoinRequest,
  type JoinRequestStatus,
  type JoinRequestSummary,
} from "../lib/joinRequestApi";
import { showToast } from "../lib/toastBus";

const PAGE_SIZE = 10;

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

/**
 * Company admin review of join requests (SRS AUTH-01-12, AUTH-01-13). A work-email sign-up whose
 * domain belongs to this Company lands here; the admin approves (the account becomes a Recruiter of
 * the Company) or rejects. The list view carries no applicant name or email, so rows show the dates
 * and the state and ids are never displayed.
 */
export default function RecruiterJoinRequestsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("joinRequest.admin.documentTitle"));
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  // The URL is 1-based, like the API. The Pagination component counts from 0.
  const page = Math.max(1, Number(params.get("page")) || 1);

  const list = useQuery({
    queryKey: ["recruiter", "join-requests", companyId, page],
    queryFn: () => fetchJoinRequests(companyId, { page, size: PAGE_SIZE }),
    enabled: !!companyId,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "reject" }) =>
      action === "approve" ? approveJoinRequest(companyId, id) : rejectJoinRequest(companyId, id),
    onSuccess: (_data, vars) => {
      showToast({
        title: vars.action === "approve" ? t("joinRequest.admin.approved") : t("joinRequest.admin.rejected"),
        kind: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["recruiter", "join-requests", companyId] });
    },
    onError: (error) => {
      // 409: the request was decided or expired elsewhere; the list no longer matches the server.
      if (httpStatus(error) === 409)
        void queryClient.invalidateQueries({ queryKey: ["recruiter", "join-requests", companyId] });
    },
  });

  function setPage(next: number) {
    const merged = new URLSearchParams(params);
    if (next > 1) merged.set("page", String(next));
    else merged.delete("page");
    setParams(merged);
  }

  function decisionError(): string {
    const status = httpStatus(decide.error);
    if (status === 409) return t("joinRequest.admin.stateChanged");
    if (status === 503) return t("joinRequest.admin.linkUnavailable");
    return apiErrorMessage(decide.error, t("joinRequest.admin.decideFailed"));
  }

  const data = list.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <RecruiterShell title={t("joinRequest.admin.title")} lead={t("joinRequest.admin.lead")}>
      {!companyId && <Alert tone="warning">{t("joinRequest.admin.noCompany")}</Alert>}

      {decide.isError && <Alert tone="error">{decisionError()}</Alert>}

      {companyId && list.isPending && <SkeletonRows rows={4} label={t("joinRequest.admin.loading")} />}

      {companyId && list.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={list.isFetching} onClick={() => void list.refetch()}>
              {list.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(list.error, t("joinRequest.admin.loadWhat"))}
        </Alert>
      )}

      {companyId && data && data.items.length === 0 && <EmptyState title={t("joinRequest.admin.empty")} />}

      {companyId && data && data.items.length > 0 && (
        <>
          <p className="jp-muted">{t("joinRequest.admin.count", { total: data.total })}</p>
          <ul className="jp-join-requests" aria-label={t("joinRequest.admin.listLabel")}>
            {data.items.map((request) => (
              <JoinRequestRow
                key={request.id}
                request={request}
                busy={decide.isPending && decide.variables?.id === request.id}
                onDecide={(action) => decide.mutate({ id: request.id, action })}
              />
            ))}
          </ul>
          <Pagination
            page={page - 1}
            totalPages={totalPages}
            onPage={(p) => setPage(p + 1)}
            label={t("joinRequest.admin.paginationLabel")}
          />
        </>
      )}
    </RecruiterShell>
  );
}

function JoinRequestRow({
  request,
  busy,
  onDecide,
}: {
  request: JoinRequestSummary;
  busy: boolean;
  onDecide: (action: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();
  const sent = formatDate(request.createdAt);
  const pending = request.status === "Pending";

  return (
    <li className="jp-join-request">
      <div className="jp-join-request-head">
        <StatusMark tone={STATUS_TONE[request.status]}>{t(STATUS_KEY[request.status])}</StatusMark>
        <span className="jp-muted">{t("joinRequest.admin.sentOn", { date: sent })}</span>
      </div>
      <p className="jp-join-request-meta">
        {t("joinRequest.admin.expiresOn", { date: formatDate(request.expiresAt) })}
      </p>
      {request.decidedAt && (
        <p className="jp-join-request-meta">
          {t("joinRequest.admin.decidedOn", { date: formatDateTime(request.decidedAt) })}
        </p>
      )}
      {request.decisionReason && (
        <p className="jp-join-request-meta">{t("joinRequest.admin.reason", { reason: request.decisionReason })}</p>
      )}
      {pending ? (
        <div className="jp-join-request-actions">
          <Button
            loading={busy}
            aria-label={t("joinRequest.admin.approveLabel", { date: sent })}
            onClick={() => onDecide("approve")}
          >
            {t("joinRequest.admin.approve")}
          </Button>
          <Button
            variant="secondary"
            aria-label={t("joinRequest.admin.rejectLabel", { date: sent })}
            onClick={() => onDecide("reject")}
          >
            {t("joinRequest.admin.reject")}
          </Button>
        </div>
      ) : (
        <p className="jp-join-request-meta">{t("joinRequest.admin.ended")}</p>
      )}
    </li>
  );
}
