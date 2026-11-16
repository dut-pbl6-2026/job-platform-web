import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  ApplicationStatusMark,
  BackLink,
  Button,
  ButtonLink,
  EmptyState,
  PageHead,
  Panel,
  SkeletonBlock,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { downloadCv, fetchApplicationById } from "../lib/applicationsApi";
import { formatDateTime } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { locationLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

// Internal signal only: the page renders its own translated copy for this case, so the message is not shown.
class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found.");
  }
}

export default function ApplicationDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const [cvBusy, setCvBusy] = useState(false);
  const [cvErr, setCvErr] = useState<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.application(id || ""),
    queryFn: async () => {
      const found = await fetchApplicationById(id!, user!.id);
      if (!found) throw new ApplicationNotFoundError();
      return found;
    },
    enabled: !!id && !!user,
    staleTime: 0,
    retry: (count, e) => !(e instanceof ApplicationNotFoundError) && count < 1,
  });

  const app = query.data;
  const notFound = query.error instanceof ApplicationNotFoundError;
  const failure = !query.isError || notFound ? null : loadErrorMessage(query.error, t("applications.detail.loadWhat"));
  useDocumentTitle(
    app ? `${app.jobTitle || t("applications.detail.fallbackTitle")}` : t("applications.detail.documentFallback"),
  );

  async function openCv(cvUrl: string, fileName?: string | null) {
    setCvBusy(true);
    setCvErr(null);
    try {
      await downloadCv(cvUrl, fileName);
    } catch (e) {
      setCvErr(apiErrorMessage(e, t("applications.detail.cvFailed")));
    } finally {
      setCvBusy(false);
    }
  }

  if (query.isPending) {
    return (
      <>
        <main className="jp-page">
          <BackLink to="/applications">{t("nav.myApplications")}</BackLink>
          <SkeletonBlock height={360} label={t("applications.loading")} />
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title={t("applications.detail.notFound")}
            action={<ButtonLink to="/applications">{t("applications.detail.backToList")}</ButtonLink>}
          />
        </main>
      </>
    );
  }

  if (failure || !app) {
    return (
      <>
        <main className="jp-page jp-page--narrow">
          <BackLink to="/applications">{t("nav.myApplications")}</BackLink>
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
        </main>
      </>
    );
  }

  const company = app.companyName?.trim();
  const letter = app.coverLetter?.trim();
  const history = [...(app.statusHistory ?? [])].sort((a, b) => +new Date(a.changedAt) - +new Date(b.changedAt));
  const submitted = formatDateTime(app.createdAt);
  const updated = formatDateTime(app.updatedAt);

  return (
    <>
      <main className="jp-page">
        <PageHead
          back={<BackLink to="/applications">{t("nav.myApplications")}</BackLink>}
          title={app.jobTitle || t("applications.detail.fallbackTitle")}
          lead={[company, app.location ? locationLabel(app.location) : null].filter(Boolean).join(" · ") || undefined}
          actions={
            app.jobId ? (
              <ButtonLink to={`/jobs/${app.jobId}`} variant="secondary">
                {t("applications.detail.viewJob")}
              </ButtonLink>
            ) : undefined
          }
        />

        <div className="jp-detail-grid">
          <div className="jp-detail-main">
            <section className="jp-detail-section">
              <h2 className="jp-h3">{t("applications.detail.letter")}</h2>
              {letter ? (
                <p className="jp-prose">{letter}</p>
              ) : (
                <p className="jp-muted">{t("applications.detail.noLetter")}</p>
              )}
            </section>

            {history.length > 0 && (
              <section className="jp-detail-section">
                <h2 className="jp-h3">{t("applications.detail.history")}</h2>
                <ol className="jp-history">
                  {history.map((h) => (
                    <li key={h.id} className="jp-history-row">
                      <span className="jp-history-time">{formatDateTime(h.changedAt)}</span>
                      <span className="jp-history-status">
                        <ApplicationStatusMark status={h.status} />
                      </span>
                      {h.note && <span className="jp-history-note">{h.note}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <div className="jp-detail-side">
            <Panel title={t("applications.detail.statusPanel")} className="jp-detail-apply">
              <p className="jp-app-status">
                <ApplicationStatusMark status={app.status} />
              </p>
              <dl className="jp-detail-kv">
                {submitted && (
                  <div>
                    <dt>{t("applications.detail.submittedAt")}</dt>
                    <dd>{submitted}</dd>
                  </div>
                )}
                {updated && updated !== submitted && (
                  <div>
                    <dt>{t("applications.detail.updatedAt")}</dt>
                    <dd>{updated}</dd>
                  </div>
                )}
              </dl>
            </Panel>

            <Panel title={t("applications.detail.cvPanel")} className="jp-detail-company-panel">
              {app.cvUrl ? (
                <>
                  <Button
                    variant="secondary"
                    icon="download"
                    block
                    loading={cvBusy}
                    onClick={() => void openCv(app.cvUrl!, app.cvFileName)}
                    className="jp-cv-button"
                  >
                    <span className="jp-cv-name">
                      {cvBusy
                        ? t("applications.detail.downloading")
                        : app.cvFileName || t("applications.detail.downloadCv")}
                    </span>
                  </Button>
                  {cvErr && (
                    <Alert tone="error" className="jp-cv-error">
                      {cvErr}
                    </Alert>
                  )}
                </>
              ) : (
                <p className="jp-cv-plain">{app.cvFileName || t("applications.detail.cvFallback")}</p>
              )}
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
