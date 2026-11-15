import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
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

const BAND_KEYS = {
  Strong: "resumeScore.bands.Strong",
  Good: "resumeScore.bands.Good",
  Partial: "resumeScore.bands.Partial",
  Weak: "resumeScore.bands.Weak",
} as const satisfies Record<ScoreBand, string>;

const LEVEL_KEYS: Record<
  string,
  | "resumeScore.levels.none"
  | "resumeScore.levels.diploma"
  | "resumeScore.levels.bachelor"
  | "resumeScore.levels.master"
  | "resumeScore.levels.phd"
  | undefined
> = {
  none: "resumeScore.levels.none",
  diploma: "resumeScore.levels.diploma",
  bachelor: "resumeScore.levels.bachelor",
  master: "resumeScore.levels.master",
  phd: "resumeScore.levels.phd",
};

const WARNING_KEYS: [
  RegExp,
  (
    | "resumeScore.warnings.hidden"
    | "resumeScore.warnings.pages"
    | "resumeScore.warnings.ocr"
    | "resumeScore.warnings.rotated"
    | "resumeScore.warnings.notCv"
  ),
][] = [
  [/^hidden_text_removed/, "resumeScore.warnings.hidden"],
  [/^pages_truncated/, "resumeScore.warnings.pages"],
  [/^low_ocr_confidence/, "resumeScore.warnings.ocr"],
  [/^page_rotated/, "resumeScore.warnings.rotated"],
  [/^not_cv_like/, "resumeScore.warnings.notCv"],
];

/** Jobs come through normalizeJob, so `company` is always nested. */
function companyOf(j: Job): string {
  return j.company?.name ?? "";
}

function warningText(w: string): string {
  const key = WARNING_KEYS.find(([re]) => re.test(w))?.[1];
  return key ? i18n.t(key) : w;
}

/** Level code from the backend, shown as its label; an unknown code is shown as the backend sent it. */
function levelText(code: string): string {
  const key = LEVEL_KEYS[code];
  return key ? i18n.t(key) : code;
}

function ScoreRing({ value, band }: { value: number; band: ScoreBand }) {
  const { t } = useTranslation();
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className={`rs-ring rs-${band.toLowerCase()}`} role="img" aria-label={t("resumeScore.scoreLabel", { value })}>
      <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden>
        <circle cx="60" cy="60" r={r} className="rs-ring-bg" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className="rs-ring-fg"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="rs-ring-label">
        <strong>{value}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

function Bar({ label, value, note }: { label: string; value: number | null; note?: string }) {
  return (
    <div className="rs-bar">
      <div className="rs-bar-head">
        <span>{label}</span>
        <strong>{value === null ? "—" : `${value}`}</strong>
      </div>
      <div className="rs-bar-track" aria-hidden>
        <div className="rs-bar-fill" style={{ width: `${value ?? 0}%` }} />
      </div>
      {note && <div className="jp-muted rs-note">{note}</div>}
    </div>
  );
}

function Chips({
  title,
  items,
  tone,
  evidence,
}: {
  title: string;
  items: string[];
  tone?: "ok" | "miss" | "neg";
  evidence?: Record<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <h3 className="rs-sub">{title}</h3>
      <ul className="rs-chips">
        {items.map((s) => (
          <li key={s} className={cx("rs-chip", tone && `rs-${tone}`)} title={evidence?.[s]}>
            {s}
          </li>
        ))}
      </ul>
    </>
  );
}

function Result({ r }: { r: ResumeScore }) {
  const { t } = useTranslation();
  const b = r.breakdown;
  return (
    <div className="rs-result" aria-live="polite">
      <Panel className="rs-summary">
        <ScoreRing value={r.overall_score} band={r.band} />
        <div>
          <div className={`rs-band rs-${r.band.toLowerCase()}`}>{t(BAND_KEYS[r.band])}</div>
          <p className="jp-muted">{t("resumeScore.disclaimer")}</p>
          <p className="jp-muted">
            {r.meta.parser === "ocr"
              ? t("resumeScore.parser.ocr")
              : r.meta.parser === "docx"
                ? t("resumeScore.parser.docx")
                : t("resumeScore.parser.text")}{" "}
            {t("resumeScore.meta", {
              seconds: (r.meta.elapsed_ms / 1000).toFixed(1),
              cached: r.meta.cached ? t("resumeScore.cachedNote") : "",
            })}
          </p>
        </div>
      </Panel>

      {r.warnings.length > 0 && (
        <Alert tone="warning">
          {r.warnings.map((w) => (
            <p key={w}>{warningText(w)}</p>
          ))}
        </Alert>
      )}

      <div className="rs-grid">
        <Panel title={t("resumeScore.sections.skills")}>
          <Bar label={t("resumeScore.skillMatch")} value={b.skills.score} />
          <Chips title={t("resumeScore.matched")} items={b.skills.matching} tone="ok" evidence={b.skills.evidence} />
          <Chips title={t("resumeScore.missing")} items={b.skills.missing} tone="miss" />
          <Chips title={t("resumeScore.negated")} items={b.skills.negated} tone="neg" />
          <Chips title={t("resumeScore.extra")} items={b.skills.extra} />
        </Panel>

        <Panel title={t("resumeScore.sections.semantic")}>
          <Bar label={t("resumeScore.semanticSimilarity")} value={b.semantic.score} />
          {b.semantic.top_matches.map((m) => (
            <div key={m.requirement} className="rs-match">
              <div className="rs-match-req">{t("resumeScore.requirement", { text: m.requirement })}</div>
              <div className="jp-muted">{t("resumeScore.cvExcerpt", { text: m.cv_excerpt })}</div>
            </div>
          ))}
        </Panel>

        <Panel title={t("resumeScore.sections.experience")}>
          <Bar
            label={t("resumeScore.levelMatch")}
            value={b.experience.score}
            note={t("resumeScore.experienceNote", {
              cvYears: b.experience.cv_years,
              requirement: b.experience.required_years
                ? t("resumeScore.experienceRequired", { years: b.experience.required_years })
                : t("resumeScore.experienceNoRequirement"),
            })}
          />
        </Panel>

        <Panel title={t("resumeScore.sections.education")}>
          <Bar
            label={t("resumeScore.levelMatch")}
            value={b.education.score}
            note={t("resumeScore.educationNote", {
              cvLevel: levelText(b.education.cv_level),
              requiredLevel: levelText(b.education.required_level),
            })}
          />
        </Panel>
      </div>

      {r.suggestions.length > 0 && (
        <Panel title={t("resumeScore.sections.suggestions")}>
          <ul className="rs-suggest">
            {r.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

export default function ResumeScorePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("resumeScore.title"));
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
        .then((p) => {
          if (alive) setOptions(p.items);
        })
        .catch(() => {
          if (alive) setOptions([]);
        });
    } else {
      fetchJobById(jobId)
        .then((j) => {
          if (alive) j ? setJob(j) : setJobErr(i18n.t("resumeScore.jobNotFound"));
        })
        .catch(() => {
          if (alive) setJobErr(i18n.t("resumeScore.jobLoadFailed"));
        });
    }
    return () => {
      alive = false;
    };
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
          back={
            jobId ? (
              <BackLink to={`/jobs/${jobId}`}>{t("resumeScore.backToJob")}</BackLink>
            ) : (
              <BackLink to="/jobs">{t("jobs.boardTitle")}</BackLink>
            )
          }
          title={
            <>
              {t("resumeScore.title")} <DevTag />
            </>
          }
          lead={t("resumeScore.lead")}
        />

        {!jobId && (
          <Panel className="rs-pick">
            <Field id="rs-job" label={t("resumeScore.chooseJobLabel")}>
              <Select value="" onChange={(e) => e.target.value && setParams({ jobId: e.target.value })}>
                <option value="">{t("resumeScore.chooseJobPlaceholder")}</option>
                {options.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {companyOf(j)}
                  </option>
                ))}
              </Select>
            </Field>
          </Panel>
        )}

        {jobErr && <Alert tone="error">{jobErr}</Alert>}
        {job && (
          <div className="rs-job">
            <Board label={t("resumeScore.jobScored")} className="jp-apply-job">
              <JobRow job={job} static />
            </Board>
            <Button variant="secondary" onClick={() => setParams({})}>
              {t("resumeScore.changeJob")}
            </Button>
          </div>
        )}

        {jobId && !jobErr && (
          <form className="jp-panel rs-form" onSubmit={onSubmit} noValidate>
            <Field id="rs-cv" label={t("apply.cvLabel")} required hint={t("resumeScore.cvHint")} error={fileErr}>
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
                      <span>{t("resumeScore.cvChange", { size: (file.size / 1024 / 1024).toFixed(2) })}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Icon name="upload" size={24} />
                    <span className="jp-drop-text">
                      <strong>{t("resumeScore.chooseCv")}</strong>
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
              {busy ? t("resumeScore.analyzing") : t("resumeScore.submit")}
            </Button>
            {busy && <p className="jp-muted">{t("resumeScore.ocrNote")}</p>}
          </form>
        )}

        {error && (
          <Alert tone="error" className="rs-err">
            {error.message}
          </Alert>
        )}
        {result && <Result r={result} />}
      </main>
    </>
  );
}
