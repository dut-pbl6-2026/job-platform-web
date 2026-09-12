import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { isUser } from "../lib/roles";
import { fetchJobById, formatSalary } from "../lib/jobsApi";
import { CV_ACCEPT, submitApplication, validateCvFile } from "../lib/applicationsApi";
import type { Job } from "../types/job";

export default function ApplyPage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [doneId, setDoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchJobById(id)
      .then((j) => { if (alive) setJob(j); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (!isAuthenticated) return null;
  if (!isUser(user?.role)) {
    return (
      <>
        <AppHeader />
        <div className="container apply-wrap">
          <div className="alert alert-error">Chỉ người tìm việc mới ứng tuyển được.</div>
          <Link to={`/jobs/${id}`} className="btn btn-ghost">← Về tin tuyển dụng</Link>
        </div>
      </>
    );
  }

  if (loading) return (<><AppHeader /><div className="container"><div className="skeleton-detail" /></div></>);
  if (!job) return (<><AppHeader /><div className="container"><div className="alert alert-error">Không tìm thấy việc làm</div></div></>);
  const currentJob = job;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe = validateCvFile(file);
    setFileErr(fe);
    if (fe || !file || !user) return;
    setSending(true);
    try {
      const res = await submitApplication({ jobId: currentJob.id, coverLetter: cover.trim() || undefined, cvFile: file, applicantId: user.id });
      setDoneId(res.id);
    } catch (ex: unknown) {
      const ax = ex as { response?: { status?: number; data?: { message?: string } } };
      if (ax.response?.status === 409) setErr(ax.response.data?.message || "Bạn đã ứng tuyển tin này rồi");
      else setErr(ax.response?.data?.message || "Gửi hồ sơ thất bại. Thử lại nhé.");
    } finally {
      setSending(false);
    }
  }

  function onPick(f: File | null) {
    setFile(f);
    setFileErr(f ? validateCvFile(f) : null);
  }

  if (doneId) {
    return (
      <>
        <AppHeader />
        <div className="container apply-wrap">
          <div className="card apply-success">
            <div className="apply-success-icon" aria-hidden>✓</div>
            <h1>Đã gửi hồ sơ</h1>
            <p className="hint">Nhà tuyển dụng sẽ xem CV của bạn. Theo dõi kết quả ở mục Đơn của tôi.</p>
            <div className="apply-success-actions">
              <Link className="btn btn-primary" to="/applications">Xem đơn của tôi</Link>
              <Link className="btn btn-ghost" to="/jobs">Tìm việc khác</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <div className="container apply-wrap">
        <Link to={`/jobs/${currentJob.id}`} className="hint detail-back">← Quay lại tin</Link>
        <div className="card apply-job-chip">
          <strong>{currentJob.title}</strong>
          <span className="hint">{currentJob.company.name} • {currentJob.location} • {formatSalary(currentJob.salaryMin, currentJob.salaryMax, currentJob.salaryCurrency)}</span>
        </div>
        <form className="card apply-form" onSubmit={onSubmit} noValidate>
          <h1 className="apply-title">Gửi hồ sơ</h1>
          <p className="hint apply-lead">3 bước: chọn CV → thư xin việc (không bắt buộc) → gửi.</p>
          {err && <div className="alert alert-error" role="alert">{err}</div>}

          <div className="field">
            <label className="label" htmlFor="cv">1. File CV <span className="req">*</span></label>
            <button type="button" className={`dropzone ${fileErr ? "error" : ""}`} onClick={() => fileRef.current?.click()}>
              <input
                id="cv"
                ref={fileRef}
                type="file"
                accept={CV_ACCEPT}
                hidden
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span className="hint">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </>
              ) : (
                <>
                  <strong>Chọn file CV</strong>
                  <span className="hint">PDF, DOC, DOCX — tối đa 5 MB</span>
                </>
              )}
            </button>
            <div className="help">{fileErr ?? ""}</div>
          </div>

          <div className="field">
            <label className="label" htmlFor="cover">2. Thư xin việc (không bắt buộc)</label>
            <textarea
              id="cover"
              className="textarea"
              rows={6}
              maxLength={4000}
              placeholder="Ví dụ: Tôi muốn ứng tuyển vì..."
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
            <div className="hint">{cover.length}/4000</div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" disabled={sending}>
            {sending && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />}
            {sending ? "Đang gửi..." : "3. Gửi hồ sơ"}
          </button>
        </form>
      </div>
    </>
  );
}
