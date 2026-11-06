import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  BackLink,
  Board,
  Button,
  DevTag,
  Field,
  Icon,
  JobRow,
  PageHead,
  Panel,
  Select,
  TopBar,
  cx,
} from "../components/ui";
import { fetchJobById, fetchJobs } from "../lib/jobsApi";
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
      {note && <div className="jp-muted rs-note">{note}</div>}
    </div>
  );
}

function Chips({ title, items, tone, evidence }: { title: string; items: string[]; tone?: "ok" | "miss" | "neg"; evidence?: Record<string, string> }) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="rs-sub">{title}</h3>
      <ul className="rs-chips">
        {items.map((s) => <li key={s} className={cx("rs-chip", tone && `rs-${tone}`)} title={evidence?.[s]}>{s}</li>)}
      </ul>
    </>
  );
}

function Result({ r }: { r: ResumeScore }) {
  const b = r.breakdown;
  return (
    <div className="rs-result" aria-live="polite">
      <Panel className="rs-summary">
        <ScoreRing value={r.overall_score} band={r.band} />
        <div>
          <div className={`rs-band rs-${r.band.toLowerCase()}`}>{BAND_TEXT[r.band]}</div>
          <p className="jp-muted">Điểm mang tính tham khảo, được tính bằng mô hình chạy nội bộ (không gửi CV cho dịch vụ AI bên ngoài). Nhà tuyển dụng vẫn là người quyết định.</p>
          <p className="jp-muted">{r.meta.parser === "ocr" ? "CV dạng ảnh, đọc bằng OCR" : r.meta.parser === "docx" ? "CV dạng DOCX" : "CV có lớp chữ"} • {(r.meta.elapsed_ms / 1000).toFixed(1)} giây{r.meta.cached ? " • kết quả đã lưu tạm" : ""}</p>
        </div>
      </Panel>

      {r.warnings.length > 0 && <Alert tone="warning">{r.warnings.map((w) => <p key={w}>{warningText(w)}</p>)}</Alert>}

      <div className="rs-grid">
        <Panel title="Kỹ năng">
          <Bar label="Mức khớp kỹ năng" value={b.skills.score} />
          <Chips title="Đã có" items={b.skills.matching} tone="ok" evidence={b.skills.evidence} />
          <Chips title="Còn thiếu" items={b.skills.missing} tone="miss" />
          <Chips title="CV ghi là chưa có" items={b.skills.negated} tone="neg" />
          <Chips title="Kỹ năng khác trong CV" items={b.skills.extra} />
        </Panel>

        <Panel title="Mức liên quan nội dung">
          <Bar label="Tương đồng ngữ nghĩa" value={b.semantic.score} />
          {b.semantic.top_matches.map((m) => (
            <div key={m.requirement} className="rs-match">
              <div className="rs-match-req">Yêu cầu: {m.requirement}</div>
              <div className="jp-muted">CV: “{m.cv_excerpt}”</div>
            </div>
          ))}
        </Panel>

        <Panel title="Kinh nghiệm">
          <Bar label="Mức đáp ứng" value={b.experience.score} note={`CV thể hiện ≈ ${b.experience.cv_years} năm${b.experience.required_years ? ` • yêu cầu ≈ ${b.experience.required_years} năm` : " • tin không nêu số năm"}`} />
        </Panel>

        <Panel title="Học vấn">
          <Bar label="Mức đáp ứng" value={b.education.score} note={`CV: ${LEVEL_TEXT[b.education.cv_level] ?? b.education.cv_level} • yêu cầu: ${LEVEL_TEXT[b.education.required_level] ?? b.education.required_level}`} />
        </Panel>
      </div>

      {r.suggestions.length > 0 && (
        <Panel title="Gợi ý cải thiện CV">
          <ul className="rs-suggest">{r.suggestions.map((s) => <li key={s}>{s}</li>)}</ul>
        </Panel>
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
      <main className="jp-page rs-page">
        <PageHead
          back={jobId ? <BackLink to={`/jobs/${jobId}`}>Quay lại việc làm</BackLink> : <BackLink to="/jobs">Bảng việc làm</BackLink>}
          title={<>Kiểm tra độ phù hợp CV <DevTag /></>}
          lead="Tải CV lên để xem điểm phù hợp với một việc làm, kèm lý do và gợi ý cải thiện. Hỗ trợ PDF (cả bản scan) và DOCX."
        />

        {!jobId && (
          <Panel className="rs-pick">
            <Field id="rs-job" label="Chọn việc làm">
              <Select value="" onChange={(e) => e.target.value && setParams({ jobId: e.target.value })}>
                <option value="">— Chọn một việc làm —</option>
                {options.map((j) => <option key={j.id} value={j.id}>{j.title} — {companyOf(j)}</option>)}
              </Select>
            </Field>
          </Panel>
        )}

        {jobErr && <Alert tone="error">{jobErr}</Alert>}
        {job && (
          <div className="rs-job">
            <Board label="Việc làm được chấm" className="jp-apply-job">
              <JobRow job={job} static />
            </Board>
            <Button variant="secondary" onClick={() => setParams({})}>Đổi việc làm</Button>
          </div>
        )}

        {jobId && !jobErr && (
          <form className="jp-panel rs-form" onSubmit={onSubmit} noValidate>
            <Field id="rs-cv" label="File CV" required hint="PDF hoặc DOCX, tối đa 5 MB." error={fileErr}>
              <button
                type="button"
                className={cx("jp-drop", fileErr && "is-error", file && "has-file")}
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <>
                    <Icon name="file" size={24} />
                    <span className="jp-drop-text">
                      <strong>{file.name}</strong>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB · bấm để chọn file khác</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Icon name="upload" size={24} />
                    <span className="jp-drop-text">
                      <strong>Chọn file CV</strong>
                    </span>
                  </>
                )}
              </button>
            </Field>
            <input
              ref={fileRef}
              type="file"
              accept={SCORE_CV_ACCEPT}
              hidden
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <Button type="submit" size="lg" block loading={busy} disabled={!file}>
              {busy ? "Đang phân tích CV…" : "Chấm điểm CV"}
            </Button>
            {busy && <p className="jp-muted">CV dạng ảnh cần đọc bằng OCR nên có thể mất vài giây.</p>}
          </form>
        )}

        {error && <Alert tone="error" className="rs-err">{error.message}</Alert>}
        {result && <Result r={result} />}
      </main>
    </>
  );
}
