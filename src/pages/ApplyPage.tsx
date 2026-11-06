import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  BackLink,
  Board,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Icon,
  JobRow,
  PageHead,
  Panel,
  SkeletonBlock,
  Textarea,
  TopBar,
  cx,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchJobById } from "../lib/jobsApi";
import { CV_ACCEPT, submitApplication, validateCvFile } from "../lib/applicationsApi";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

class JobNotFoundError extends Error {
  constructor() {
    super("Việc làm không tồn tại hoặc đã bị gỡ.");
  }
}

const COVER_MAX = 4000;

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("vi-VN")} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} MB`;
}

type SubmitError = { message: string; duplicate: boolean };

export default function ApplyPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const pickRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState("");
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<SubmitError | null>(null);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sent, setSent] = useState<{ fileName: string } | null>(null);

  // Same key as the detail page: arriving from there reuses the loaded job.
  // A failed load (network, 5xx) is not "job not found": fetchJobById returns null only on 404.
  const jobQuery = useQuery({
    queryKey: queryKeys.job(id || ""),
    queryFn: async () => {
      const found = await fetchJobById(id!);
      if (!found) throw new JobNotFoundError();
      return found;
    },
    enabled: !!id,
    retry: (count, e) => !(e instanceof JobNotFoundError) && count < 1,
  });
  const job = jobQuery.data;
  const notFound = jobQuery.error instanceof JobNotFoundError;
  const loadErr = !jobQuery.isError || notFound ? null : loadErrorMessage(jobQuery.error, "tin tuyển dụng");

  useDocumentTitle(job ? `Ứng tuyển · ${job.title}` : "Ứng tuyển");

  // The success screen replaces the form: move focus to its heading so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  if (!isAuthenticated) return null;

  const jobHref = `/jobs/${id}`;

  if (!isUser(user?.role)) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <BackLink to={jobHref}>Về tin tuyển dụng</BackLink>
          <Alert tone="error">Chỉ tài khoản ứng viên mới nộp hồ sơ được.</Alert>
        </main>
      </>
    );
  }

  if (jobQuery.isPending) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-apply">
          <BackLink to={jobHref}>Quay lại tin tuyển dụng</BackLink>
          <SkeletonBlock height={420} label="Đang tải tin tuyển dụng" />
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

  if (loadErr || !job) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <BackLink to={jobHref}>Quay lại tin tuyển dụng</BackLink>
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={jobQuery.isFetching} onClick={() => void jobQuery.refetch()}>
                {jobQuery.isFetching ? "Đang thử lại…" : "Thử lại"}
              </Button>
            }
          >
            {loadErr ?? "Không tải được tin tuyển dụng."}
          </Alert>
        </main>
      </>
    );
  }

  const currentJob = job;

  function pick(f: File | null) {
    setFile(f);
    setFileErr(f ? validateCvFile(f) : null);
    setSubmitErr(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pick(f);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitErr(null);
    const fe = validateCvFile(file);
    setFileErr(fe);
    if (fe || !file || !user) {
      if (fe) dropRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      await submitApplication({ jobId: currentJob.id, coverLetter: cover.trim() || undefined, cvFile: file, applicantId: user.id });
      setSent({ fileName: file.name });
    } catch (ex: unknown) {
      if (httpStatus(ex) === 409) {
        setSubmitErr({ message: "Bạn đã nộp hồ sơ cho tin này rồi.", duplicate: true });
      } else {
        setSubmitErr({ message: apiErrorMessage(ex, "Gửi hồ sơ thất bại. Vui lòng thử lại."), duplicate: false });
      }
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <>
        <TopBar />
        <main className="jp-page jp-page--narrow">
          <Panel className="jp-apply-done">
            <Icon name="checkCircle" size={32} className="jp-apply-done-icon" />
            <h1 className="jp-h1" ref={doneRef} tabIndex={-1}>Đã gửi hồ sơ</h1>
            <dl className="jp-apply-sent">
              <div>
                <dt>Vị trí</dt>
                <dd>{currentJob.title}</dd>
              </div>
              <div>
                <dt>Công ty</dt>
                <dd>{currentJob.company.name}</dd>
              </div>
              <div>
                <dt>File CV đã gửi</dt>
                <dd>{sent.fileName}</dd>
              </div>
            </dl>
            <p className="jp-muted">Nhà tuyển dụng sẽ xem CV của bạn. Theo dõi kết quả ở mục Đơn của tôi.</p>
            <div className="jp-apply-done-actions">
              <ButtonLink to="/applications">Xem đơn của tôi</ButtonLink>
              <ButtonLink variant="secondary" to="/jobs">Tìm việc khác</ButtonLink>
            </div>
          </Panel>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <main className="jp-page jp-apply">
        <PageHead
          back={<BackLink to={jobHref}>Quay lại tin tuyển dụng</BackLink>}
          title="Gửi hồ sơ ứng tuyển"
          lead="Chọn CV, viết thêm thư xin việc nếu muốn, rồi gửi."
        />

        <Board label="Tin bạn đang ứng tuyển" className="jp-apply-job">
          <JobRow job={currentJob} static />
        </Board>

        <form className="jp-panel jp-apply-form" onSubmit={onSubmit} noValidate>
          {submitErr && (
            <Alert
              tone="error"
              action={submitErr.duplicate ? <ButtonLink variant="secondary" to="/applications">Xem đơn đã nộp</ButtonLink> : undefined}
            >
              {submitErr.message}
            </Alert>
          )}

          <ol className="jp-steps">
            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">1</span>
              <div className="jp-step-body">
                <Field
                  id="apply-cv"
                  label="File CV"
                  required
                  hint="PDF, DOC hoặc DOCX, tối đa 5 MB."
                  error={fileErr}
                >
                  <button
                    ref={dropRef}
                    type="button"
                    className={cx("jp-drop", dragging && "is-dragging", fileErr && "is-error", file && "has-file")}
                    onClick={() => pickRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                  >
                    {file ? (
                      <>
                        <Icon name="file" size={24} />
                        <span className="jp-drop-text">
                          <strong>{file.name}</strong>
                          <span>{fileSize(file.size)} · bấm để chọn file khác</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Icon name="upload" size={24} />
                        <span className="jp-drop-text">
                          <strong>Chọn file CV</strong>
                          <span>hoặc kéo thả file vào đây</span>
                        </span>
                      </>
                    )}
                  </button>
                </Field>
                <input
                  ref={pickRef}
                  type="file"
                  accept={CV_ACCEPT}
                  hidden
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => {
                    pick(e.target.files?.[0] ?? null);
                    // Picking the same file again after a rejection must still fire onChange.
                    e.target.value = "";
                  }}
                />
                {file && (
                  <Button variant="ghost" size="sm" icon="trash" onClick={() => pick(null)}>
                    Bỏ file này
                  </Button>
                )}
              </div>
            </li>

            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">2</span>
              <div className="jp-step-body">
                <Field id="apply-cover" label="Thư xin việc" optional hint={`${cover.length.toLocaleString("vi-VN")}/${COVER_MAX.toLocaleString("vi-VN")} ký tự`}>
                  <Textarea
                    rows={6}
                    maxLength={COVER_MAX}
                    placeholder="Ví dụ: Tôi muốn ứng tuyển vì…"
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                  />
                </Field>
              </div>
            </li>

            <li className="jp-step">
              <span className="jp-step-no" aria-hidden="true">3</span>
              <div className="jp-step-body">
                <p className="jp-step-title">Gửi hồ sơ</p>
                <Button type="submit" size="lg" loading={sending} className="jp-apply-submit">
                  {sending ? "Đang gửi…" : "Gửi hồ sơ"}
                </Button>
              </div>
            </li>
          </ol>
        </form>
      </main>
    </>
  );
}
