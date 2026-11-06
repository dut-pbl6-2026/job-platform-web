import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TopBar } from "../components/ui";
import { fetchJobById, fetchJobs, formatSalary } from "../lib/jobsApi";
import { SCORE_CV_ACCEPT, scoreResume, toScoreError, validateScoreCv } from "../lib/aiApi";
import type { Job } from "../types/job";
import type { ResumeScore, ScoreBand, ScoreError } from "../types/resumeScore";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import "../styles/resumeScore.css";

const BAND_TEXT: Record<ScoreBand, string> = { Strong: "Rất phù hợp", Good: "Phù hợp", Partial: "Phù hợp một phần", Weak: "Chưa phù hợp" };
const LEVEL_TEXT: Record<string, string> = { none: "Không yêu cầu / chưa rõ", diploma: "Cao đẳng", bachelor: "Đại học", master: "Thạc sĩ", phd: "Tiến sĩ" };
const WARNING_TEXT: [RegExp, string][] = [
  [/^hidden_text_removed/, "Phát hiện và đã bỏ qua văn bản ẩn trong file."],
  [/^pages_truncated/, "CV dài, chỉ 5 trang đầu được chấm."],
  [/^low_ocr_confidence/, "Chất lượng ảnh CV thấp nên kết quả đọc chữ có thể kém chính xác."],
  [/^page_rotated/, "Một trang bị xoay và đã được tự động chỉnh."],
  [/^not_cv_like/, "File này không giống một CV nên điểm bị giới hạn."],
];

/** Jobs come through normalizeJob, so `company` is always nested. */
function companyOf(j: Job): string {
  return j.company?.name ?? "";
}

function warningText(w: string): string {
  return WARNING_TEXT.find(([re]) => re.test(w))?.[1] ?? w;
}

function ScoreRing({ value, band }: { value: number; band: ScoreBand }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={`rs-ring rs-${band.toLowerCase()}`} role="img" aria-label={`Điểm phù hợp ${value} trên 100`}>
      <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden>
        <circle cx="60" cy="60" r={r} className="rs-ring-bg" />
        <circle cx="60" cy="60" r={r} className="rs-ring-fg" strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="rs-ring-label"><strong>{value}</strong><span>/100</span></div>
    </div>
  );
}

function Bar({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="rs-bar">
      <div className="rs-bar-head"><span>{label}</span><strong>{value === null ? "—" : `${value}`}</strong></div>
      <div className="rs-bar-track" aria-hidden><div className="rs-bar-fill" style={{ width: `${value ?? 0}%` }} /></div>
      {note && <div className="hint">{note}</div>}
    </div>
  );
}

function Result({ r }: { r: ResumeScore }) {
  const b = r.breakdown;
  return (
    <div className="rs-result" aria-live="polite">
      <div className="card rs-summary">
        <ScoreRing value={r.overall_score} band={r.band} />
        <div>
          <div className={`rs-band rs-${r.band.toLowerCase()}`}>{BAND_TEXT[r.band]}</div>
          <p className="hint">Điểm mang tính tham khảo, được tính bằng mô hình chạy nội bộ (không gửi CV cho dịch vụ AI bên ngoài). Nhà tuyển dụng vẫn là người quyết định.</p>
          <p className="hint">{r.meta.parser === "ocr" ? "CV dạng ảnh, đọc bằng OCR" : r.meta.parser === "docx" ? "CV dạng DOCX" : "CV có lớp chữ"} • {(r.meta.elapsed_ms / 1000).toFixed(1)} giây{r.meta.cached ? " • kết quả đã lưu tạm" : ""}</p>
        </div>
      </div>

      {r.warnings.length > 0 && <div className="alert alert-error rs-warn" role="status">{r.warnings.map((w) => <div key={w}>{warningText(w)}</div>)}</div>}

      <div className="rs-grid">
        <div className="card">
          <h2 className="rs-h">Kỹ năng</h2>
          <Bar label="Mức khớp kỹ năng" value={b.skills.score} />
          {b.skills.matching.length > 0 && <><div className="rs-sub">Đã có</div><div className="rs-chips">{b.skills.matching.map((s) => <span key={s} className="rs-chip rs-ok" title={b.skills.evidence[s]}>{s}</span>)}</div></>}
          {b.skills.missing.length > 0 && <><div className="rs-sub">Còn thiếu</div><div className="rs-chips">{b.skills.missing.map((s) => <span key={s} className="rs-chip rs-miss">{s}</span>)}</div></>}
          {b.skills.negated.length > 0 && <><div className="rs-sub">CV ghi là chưa có</div><div className="rs-chips">{b.skills.negated.map((s) => <span key={s} className="rs-chip rs-neg">{s}</span>)}</div></>}
          {b.skills.extra.length > 0 && <><div className="rs-sub">Kỹ năng khác trong CV</div><div className="rs-chips">{b.skills.extra.map((s) => <span key={s} className="rs-chip">{s}</span>)}</div></>}
        </div>

        <div className="card">
          <h2 className="rs-h">Mức liên quan nội dung</h2>
          <Bar label="Tương đồng ngữ nghĩa" value={b.semantic.score} />
          {b.semantic.top_matches.map((m) => (
            <div key={m.requirement} className="rs-match">
              <div className="rs-match-req">Yêu cầu: {m.requirement}</div>
              <div className="hint">CV: “{m.cv_excerpt}”</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="rs-h">Kinh nghiệm</h2>
          <Bar label="Mức đáp ứng" value={b.experience.score} note={`CV thể hiện ≈ ${b.experience.cv_years} năm${b.experience.required_years ? ` • yêu cầu ≈ ${b.experience.required_years} năm` : " • tin không nêu số năm"}`} />
        </div>

        <div className="card">
          <h2 className="rs-h">Học vấn</h2>
          <Bar label="Mức đáp ứng" value={b.education.score} note={`CV: ${LEVEL_TEXT[b.education.cv_level] ?? b.education.cv_level} • yêu cầu: ${LEVEL_TEXT[b.education.required_level] ?? b.education.required_level}`} />
        </div>
      </div>

      {r.suggestions.length > 0 && (
        <div className="card">
          <h2 className="rs-h">Gợi ý cải thiện CV</h2>
          <ul className="rs-suggest">{r.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function ResumeScorePage() {
  useDocumentTitle("Kiểm tra độ phù hợp CV");
  const [params, setParams] = useSearchParams();
  const jobId = params.get("jobId") || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [jobErr, setJobErr] = useState<string | null>(null);
  const [options, setOptions] = useState<Job[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ScoreError | null>(null);
  const [result, setResult] = useState<ResumeScore | null>(null);

  useEffect(() => {
    let alive = true;
    setJob(null);
    setJobErr(null);
    if (!jobId) {
      fetchJobs({ page: 0, size: 20 })
        .then((p) => { if (alive) setOptions(p.items); })
        .catch(() => { if (alive) setOptions([]); });
    } else {
      fetchJobById(jobId)
        .then((j) => { if (alive) (j ? setJob(j) : setJobErr("Không tìm thấy việc làm")); })
        .catch(() => { if (alive) setJobErr("Không tải được việc làm"); });
    }
    return () => { alive = false; };
  }, [jobId]);

  function onPick(f: File | null) {
    setFile(f);
    setFileErr(f ? validateScoreCv(f) : null);
    setResult(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fe = validateScoreCv(file);
    setFileErr(fe);
    if (fe || !file || !jobId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await scoreResume(jobId, file));
    } catch (ex) {
      setError(toScoreError(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <div className="container apply-wrap rs-wrap">
        {jobId ? <Link to={`/jobs/${jobId}`} className="hint detail-back">← Quay lại tin</Link> : <Link to="/jobs" className="hint detail-back">← Danh sách việc làm</Link>}
        <h1 className="apply-title">Kiểm tra độ phù hợp CV</h1>
        <p className="hint apply-lead">Tải CV lên để xem điểm phù hợp với một việc làm, kèm lý do và gợi ý cải thiện. Hỗ trợ PDF (cả bản scan) và DOCX.</p>

        {!jobId && (
          <div className="card rs-pick">
            <label className="label" htmlFor="job">1. Chọn việc làm</label>
            <select id="job" className="input" value="" onChange={(e) => e.target.value && setParams({ jobId: e.target.value })}>
              <option value="">— Chọn một việc làm —</option>
              {options.map((j) => <option key={j.id} value={j.id}>{j.title} — {companyOf(j)}</option>)}
            </select>
          </div>
        )}

        {jobErr && <div className="alert alert-error" role="alert">{jobErr}</div>}
        {job && (
          <div className="card apply-job-chip">
            <strong>{job.title}</strong>
            <span className="hint">{companyOf(job)} • {job.location} • {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span>
            <button type="button" className="btn btn-ghost rs-change" onClick={() => setParams({})}>Đổi việc làm</button>
          </div>
        )}

        {jobId && !jobErr && (
          <form className="card apply-form" onSubmit={onSubmit} noValidate>
            <div className="field">
              <label className="label" htmlFor="cv">File CV <span className="req">*</span></label>
              <button type="button" className={`dropzone ${fileErr ? "error" : ""}`} onClick={() => fileRef.current?.click()}>
                <input id="cv" ref={fileRef} type="file" accept={SCORE_CV_ACCEPT} hidden onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
                {file ? (<><strong>{file.name}</strong><span className="hint">{(file.size / 1024 / 1024).toFixed(2)} MB</span></>) : (<><strong>Chọn file CV</strong><span className="hint">PDF hoặc DOCX — tối đa 5 MB</span></>)}
              </button>
              <div className="help" role="alert">{fileErr ?? ""}</div>
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || !file}>
              {busy && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />}
              {busy ? "Đang phân tích CV..." : "Chấm điểm CV"}
            </button>
            {busy && <p className="hint">CV dạng ảnh cần đọc bằng OCR nên có thể mất vài giây.</p>}
          </form>
        )}

        {error && <div className="alert alert-error rs-err" role="alert">{error.message}</div>}
        {result && <Result r={result} />}
      </div>
    </>
  );
}
