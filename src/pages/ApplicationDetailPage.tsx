import { useState } from "react";
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
  TopBar,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { downloadCv, fetchApplicationById } from "../lib/applicationsApi";
import { formatDateTime } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { locationLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

class ApplicationNotFoundError extends Error {
  constructor() {
    super("Không tìm thấy đơn ứng tuyển.");
  }
}

export default function ApplicationDetailPage() {
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
  const failure = !query.isError || notFound ? null : loadErrorMessage(query.error, "đơn ứng tuyển này");
  useDocumentTitle(app ? `${app.jobTitle || "Đơn ứng tuyển"}` : "Chi tiết đơn ứng tuyển");

  async function openCv(cvUrl: string, fileName?: string | null) {
    setCvBusy(true);
    setCvErr(null);
    try {
      await downloadCv(cvUrl, fileName);
    } catch (e) {
      setCvErr(apiErrorMessage(e, "Không tải được CV"));
    } finally {
      setCvBusy(false);
    }
  }

  if (query.isPending) {
    return (
      <>
        <TopBar />
        <main className="jp-page">
          <BackLink to="/applications">Đơn của tôi</BackLink>
          <SkeletonBlock height={360} label="Đang tải đơn ứng tuyển" />
        </main>
      </>
    );
  }

  if (notFound) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <EmptyState
            title="Không tìm thấy đơn ứng tuyển."
            action={<ButtonLink to="/applications">Về danh sách đơn</ButtonLink>}
          />
        </main>
      </>
    );
  }

  if (failure || !app) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <BackLink to="/applications">Đơn của tôi</BackLink>
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
                {query.isFetching ? "Đang thử lại…" : "Thử lại"}
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
      <TopBar />
      <main className="jp-page">
        <PageHead
          back={<BackLink to="/applications">Đơn của tôi</BackLink>}
          title={app.jobTitle || "Đơn ứng tuyển"}
          lead={[company, app.location ? locationLabel(app.location) : null].filter(Boolean).join(" · ") || undefined}
          actions={app.jobId ? <ButtonLink to={`/jobs/${app.jobId}`} variant="secondary">Xem việc làm</ButtonLink> : undefined}
        />

        <div className="jp-detail-grid">
          <div className="jp-detail-main">
            <section className="jp-detail-section">
              <h2 className="jp-h3">Thư xin việc</h2>
              {letter ? <p className="jp-prose">{letter}</p> : <p className="jp-muted">Bạn không gửi thư xin việc.</p>}
            </section>

            {history.length > 0 && (
              <section className="jp-detail-section">
                <h2 className="jp-h3">Lịch sử trạng thái</h2>
                <ol className="jp-history">
                  {history.map((h) => (
                    <li key={h.id} className="jp-history-row">
                      <span className="jp-history-time">{formatDateTime(h.changedAt)}</span>
                      <span className="jp-history-status"><ApplicationStatusMark status={h.status} /></span>
                      {h.note && <span className="jp-history-note">{h.note}</span>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <div className="jp-detail-side">
            <Panel title="Trạng thái" className="jp-detail-apply">
              <p className="jp-app-status"><ApplicationStatusMark status={app.status} /></p>
              <dl className="jp-detail-kv">
                {submitted && (
                  <div>
                    <dt>Nộp lúc</dt>
                    <dd>{submitted}</dd>
                  </div>
                )}
                {updated && updated !== submitted && (
                  <div>
                    <dt>Cập nhật lúc</dt>
                    <dd>{updated}</dd>
                  </div>
                )}
              </dl>
            </Panel>

            <Panel title="CV đã gửi" className="jp-detail-company-panel">
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
                    <span className="jp-cv-name">{cvBusy ? "Đang tải…" : app.cvFileName || "Tải CV"}</span>
                  </Button>
                  {cvErr && <Alert tone="error" className="jp-cv-error">{cvErr}</Alert>}
                </>
              ) : (
                <p className="jp-cv-plain">{app.cvFileName || "Đã gửi file CV"}</p>
              )}
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
