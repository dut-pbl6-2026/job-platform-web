import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  ApplicationStatusMark,
  Button,
  ButtonLink,
  EmptyState,
  FilterChip,
  PageHead,
  Pagination,
  SkeletonRows,
  TopBar,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchMyApplications } from "../lib/applicationsApi";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { locationLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { Application, ApplicationStatus } from "../types/application";
import { APPLICATION_STATUSES, STATUS_LABEL } from "../types/application";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;

function parseStatus(raw: string | null): ApplicationStatus | "" {
  return APPLICATION_STATUSES.find((s) => s === raw) ?? "";
}

export default function ApplicationHistoryPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("applications.title"));
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const status = parseStatus(sp.get("status"));
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const candidate = isUser(user?.role);

  const query = useQuery({
    queryKey: queryKeys.applications({ userId: user?.id, status, page }),
    queryFn: () => fetchMyApplications({ status: status || undefined, page, size: PAGE_SIZE, userId: user!.id }),
    enabled: !!user && candidate,
    // A CV sent a minute ago must show up here, so this list is never served from the 5-minute cache.
    staleTime: 0,
  });

  if (!candidate) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title={t("applications.candidateOnly")}
            action={<ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>}
          />
        </main>
      </>
    );
  }

  function setFilter(next: ApplicationStatus | "") {
    const params = new URLSearchParams(sp);
    if (next) params.set("status", next);
    else params.delete("status");
    params.delete("page");
    setSp(params);
  }

  function setPage(next: number) {
    const params = new URLSearchParams(sp);
    if (next) params.set("page", String(next));
    else params.delete("page");
    setSp(params);
    window.scrollTo({ top: 0 });
  }

  const data = query.data;
  const failure = query.isError ? loadErrorMessage(query.error, t("applications.loadWhat")) : null;

  return (
    <>
      <TopBar />
      <main className="jp-page">
        <PageHead title={t("applications.heading")} lead={t("applications.lead")} />

        <div className="jp-filter-row" role="group" aria-label={t("applications.filterGroup")}>
          <FilterChip pressed={!status} onClick={() => setFilter("")}>
            {t("applications.all")}
          </FilterChip>
          {APPLICATION_STATUSES.map((s) => (
            <FilterChip key={s} pressed={status === s} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]}
            </FilterChip>
          ))}
        </div>

        {failure && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
                {query.isFetching ? t("jobs.retrying") : t("jobs.retry")}
              </Button>
            }
          >
            {failure}
          </Alert>
        )}

        {query.isPending && <SkeletonRows rows={5} label={t("applications.loading")} />}

        {data && data.items.length === 0 && (
          <EmptyState
            title={
              status ? t("applications.emptyFiltered", { status: STATUS_LABEL[status] }) : t("applications.emptyNone")
            }
            action={
              status ? (
                <Button variant="secondary" onClick={() => setFilter("")}>
                  {t("applications.viewAll")}
                </Button>
              ) : (
                <ButtonLink to="/jobs">{t("jobs.detail.viewBoard")}</ButtonLink>
              )
            }
          >
            {!status && <p>{t("applications.applyHint")}</p>}
          </EmptyState>
        )}

        {data && data.items.length > 0 && (
          <>
            <p className="jp-count" aria-live="polite">
              {t("applications.count", { total: data.total.toLocaleString("vi-VN") })}
            </p>
            <div className="jp-apps">
              <div className="jp-apps-head" aria-hidden="true">
                <span>{t("applications.columnPosition")}</span>
                <span>{t("applications.columnLocation")}</span>
                <span>{t("applications.columnDate")}</span>
                <span>{t("applications.columnStatus")}</span>
              </div>
              <ol className="jp-apps-rows" aria-label={t("applications.listLabel")}>
                {data.items.map((a) => (
                  <ApplicationRow key={a.id} app={a} />
                ))}
              </ol>
            </div>
            <Pagination page={page} totalPages={data.totalPages} onPage={setPage} />
          </>
        )}
      </main>
    </>
  );
}

function ApplicationRow({ app }: { app: Application }) {
  const { t } = useTranslation();
  const company = app.companyName?.trim() || t("common.notProvided");
  return (
    <li className="jp-app-row">
      <div className="jp-row-main">
        <h3 className="jp-row-title">
          <Link to={`/applications/${app.id}`} className="jp-row-link">
            {app.jobTitle || t("applications.untitled")}
          </Link>
        </h3>
        <p className="jp-row-company" title={company}>
          {company}
        </p>
      </div>
      <span className="jp-cell">
        <span className="jp-sr">{t("applications.srLocation")}</span>
        {locationLabel(app.location)}
      </span>
      <span className="jp-cell jp-cell--date">
        <span className="jp-sr">{t("applications.srDate")}</span>
        {formatDate(app.createdAt) || t("common.notProvided")}
      </span>
      <span className="jp-cell jp-cell--status">
        <span className="jp-sr">{t("applications.srStatus")}</span>
        <ApplicationStatusMark status={app.status} />
      </span>
    </li>
  );
}
