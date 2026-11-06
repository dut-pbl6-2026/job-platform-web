import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchJobById } from "../lib/jobsApi";
import {
  Alert,
  BackLink,
  Button,
  ButtonLink,
  DevTag,
  EmptyState,
  FactStrip,
  Icon,
  Panel,
  SkeletonBlock,
  StatusMark,
  TopBar,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isAdmin, isRecruiter, isUser } from "../lib/roles";
import { queryKeys } from "../lib/queryClient";
import { safeHttpUrl } from "../lib/safeUrl";
import { loginUrl } from "../lib/redirect";
import { loadErrorMessage } from "../lib/http";
import { categoryLabel, jobStatusLabel } from "../lib/labels";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

class JobNotFoundError extends Error {
  constructor() {
    super("Việc làm không tồn tại hoặc đã bị gỡ.");
  }
}

/** The three reading sections of a job. A section with no text is folded into one "Chưa cập nhật" line. */
function sectionText(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

export default function JobDetailPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const jobQuery = useQuery({
    queryKey: queryKeys.job(id || ""),
    queryFn: async () => {
      const found = await fetchJobById(id!);
      if (!found) throw new JobNotFoundError();
      return found;
    },
    enabled: !!id,
    // A missing job will not appear on retry; real failures keep the default single retry.
    retry: (count, e) => !(e instanceof JobNotFoundError) && count < 1,
  });

  const job = jobQuery.data;
  const loading = jobQuery.isPending;
  const notFound = jobQuery.error instanceof JobNotFoundError;
  const err = !jobQuery.isError || notFound ? null : loadErrorMessage(jobQuery.error, "việc làm này");
  // Title needs the loaded job; it must stay above the early returns below (rules of hooks).
  useDocumentTitle(job ? `${job.title} · ${job.company.name}` : "Việc làm");

  if (loading) {
    return (
      <>
        <TopBar />
        <main className="jp-page">
          <BackLink to="/jobs">Quay lại bảng việc làm</BackLink>
          <SkeletonBlock height={440} label="Đang tải việc làm" />
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
            title="Việc làm không tồn tại hoặc đã bị gỡ."
            action={<ButtonLink to="/jobs">Xem bảng việc làm</ButtonLink>}
          />
        </main>
      </>
    );
  }

  if (err) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <BackLink to="/jobs">Quay lại bảng việc làm</BackLink>
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={jobQuery.isFetching} onClick={() => void jobQuery.refetch()}>
                {jobQuery.isFetching ? "Đang thử lại…" : "Thử lại"}
              </Button>
            }
          >
            {err}
          </Alert>
        </main>
      </>
    );
  }

  if (!job) return null;

  const website = safeHttpUrl(job.company.website);
  const canApply = isAuthenticated && isUser(user?.role);
  const updated = new Date(job.updatedAt);
  const sections = [
    { title: "Mô tả công việc", text: sectionText(job.description) },
    { title: "Yêu cầu", text: sectionText(job.requirements) },
    { title: "Quyền lợi", text: sectionText(job.benefits) },
  ];
  const filled = sections.filter((s) => s.text);
  const empty = sections.filter((s) => !s.text).map((s) => s.title);
  const companyFacts: [string, string][] = [
    ["Ngành", job.company.industry?.trim() ?? ""],
    ["Địa chỉ", job.company.address?.trim() ?? ""],
  ];

  return (
    <>
      <TopBar />
      <main className="jp-page jp-detail">
        <BackLink to="/jobs">Quay lại bảng việc làm</BackLink>

        <header className="jp-detail-head">
          <h1 className="jp-h1">{job.title}</h1>
          <p className="jp-detail-company">
            <span>{job.company.name}</span>
            {job.company.verified && <StatusMark tone="success">Đã xác minh</StatusMark>}
          </p>
        </header>

        {job.status !== "active" && (
          <Alert tone="warning" className="jp-detail-status">
            Tin này {jobStatusLabel(job.status).toLowerCase()}.
          </Alert>
        )}

        <FactStrip job={job} />

        <div className="jp-detail-grid">
          <article className="jp-panel jp-detail-main" aria-label="Nội dung tin tuyển dụng">
            {filled.map((s) => (
              <section key={s.title} className="jp-detail-section">
                <h2 className="jp-h3">{s.title}</h2>
                <p className="jp-prose">{s.text}</p>
              </section>
            ))}
            {empty.length > 0 && (
              <p className="jp-detail-empty jp-muted">Chưa cập nhật: {empty.join(", ")}.</p>
            )}
            <p className="jp-detail-meta jp-muted">
              {[
                `Danh mục: ${categoryLabel(job.category?.name)}`,
                Number.isNaN(updated.getTime()) ? null : `Cập nhật: ${updated.toLocaleDateString("vi-VN")}`,
                `${job.viewCount} lượt xem`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </article>

          <aside className="jp-detail-side" aria-label="Ứng tuyển và thông tin công ty">
            <Panel title="Ứng tuyển" className="jp-detail-apply">
              {canApply && (
                <div className="jp-detail-actions">
                  <ButtonLink size="lg" block to={`/jobs/${job.id}/apply`}>
                    Ứng tuyển ngay
                  </ButtonLink>
                  <ButtonLink variant="secondary" block to={`/resume-score?jobId=${job.id}`}>
                    Kiểm tra độ phù hợp CV
                    <DevTag />
                  </ButtonLink>
                </div>
              )}
              {!isAuthenticated && (
                <div className="jp-detail-actions">
                  <ButtonLink size="lg" block to={loginUrl(`/jobs/${job.id}/apply`)}>
                    Đăng nhập để ứng tuyển
                  </ButtonLink>
                  <p className="jp-detail-note jp-muted">Đăng nhập xong, bạn vào thẳng trang nộp hồ sơ cho tin này.</p>
                </div>
              )}
              {isAuthenticated && !canApply && (
                <p className="jp-detail-note jp-detail-note--reason">
                  <Icon name="info" size={16} />
                  {isRecruiter(user?.role)
                    ? "Tài khoản nhà tuyển dụng không nộp hồ sơ được. Hãy đăng nhập bằng tài khoản ứng viên."
                    : isAdmin(user?.role)
                      ? "Tài khoản quản trị không nộp hồ sơ được. Hãy đăng nhập bằng tài khoản ứng viên."
                      : "Tài khoản này không nộp hồ sơ được."}
                </p>
              )}
            </Panel>

            <Panel title="Công ty" className="jp-detail-company-panel">
              <dl className="jp-detail-kv">
                <div>
                  <dt>Tên công ty</dt>
                  <dd>{job.company.name}</dd>
                </div>
                {companyFacts.map(([term, value]) =>
                  value ? (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ) : null,
                )}
                {website && (
                  <div>
                    <dt>Website</dt>
                    <dd>
                      <a className="jp-link" href={website} target="_blank" rel="noopener noreferrer">
                        {job.company.website}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </Panel>
          </aside>
        </div>
      </main>
    </>
  );
}
