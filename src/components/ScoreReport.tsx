import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { Alert, Panel, cx } from "./ui";
import type { ResumeScore, ScoreBand } from "../types/resumeScore";

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

const WARNING_KEYS: [RegExp, string][] = [
  [/^hidden_text_removed/, "resumeScore.warnings.hidden"],
  [/^pages_truncated/, "resumeScore.warnings.pages"],
  [/^low_ocr_confidence/, "resumeScore.warnings.ocr"],
  [/^page_rotated/, "resumeScore.warnings.rotated"],
  [/^not_cv_like/, "resumeScore.warnings.notCv"],
];

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
        {items.map((skill) => (
          <li key={skill} className={cx("rs-chip", tone && `rs-${tone}`)} title={evidence?.[skill]}>
            {skill}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The full ai-svc report behind an application's score: the overall match, the four components, the
 * matched and missing skills, the requirement excerpts it compared, and the suggestions. Rendered from
 * the JSON app-svc stored when the worker scored the CV, so it needs no second call to ai-svc.
 */
export function ScoreReport({ detail, showSuggestions = true }: { detail: ResumeScore; showSuggestions?: boolean }) {
  const { t } = useTranslation();
  const b = detail.breakdown;
  const levelText = (code: string) => {
    const key = LEVEL_KEYS[code];
    return key ? i18n.t(key) : code;
  };
  const warningText = (warning: string) => {
    const key = WARNING_KEYS.find(([re]) => re.test(warning))?.[1];
    return key ? i18n.t(key as never) : warning;
  };

  return (
    <div className="jp-score-report">
      <Panel className="rs-summary">
        <ScoreRing value={detail.overall_score} band={detail.band} />
        <div>
          <div className={`rs-band rs-${detail.band.toLowerCase()}`}>{t(BAND_KEYS[detail.band])}</div>
          <p className="jp-muted">{t("resumeScore.disclaimer")}</p>
          <p className="jp-muted">
            {detail.meta.parser === "ocr"
              ? t("resumeScore.parser.ocr")
              : detail.meta.parser === "docx"
                ? t("resumeScore.parser.docx")
                : t("resumeScore.parser.text")}{" "}
            {t("resumeScore.meta", {
              seconds: (detail.meta.elapsed_ms / 1000).toFixed(1),
              cached: detail.meta.cached ? t("resumeScore.cachedNote") : "",
            })}
          </p>
        </div>
      </Panel>

      {detail.warnings.length > 0 && (
        <Alert tone="warning">
          {detail.warnings.map((warning) => (
            <p key={warning}>{warningText(warning)}</p>
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
          {b.semantic.top_matches.map((match) => (
            <div key={match.requirement} className="rs-match">
              <div className="rs-match-req">{t("resumeScore.requirement", { text: match.requirement })}</div>
              <div className="jp-muted">{t("resumeScore.cvExcerpt", { text: match.cv_excerpt })}</div>
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

      {showSuggestions && detail.suggestions.length > 0 && (
        <Panel title={t("resumeScore.sections.suggestions")}>
          <ul className="rs-suggest">
            {detail.suggestions.map((suggestion) => (
              <li key={suggestion}>{suggestion}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
