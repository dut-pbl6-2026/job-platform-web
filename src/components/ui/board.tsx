import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Job } from "../../types/job";
import { formatSalary, isNewJob, isSalaryNegotiable, timeAgo } from "../../lib/jobsApi";
import { employmentTypeLabel, experienceLevelLabel, locationLabel } from "../../lib/labels";
import { Icon } from "./Icon";
import { NewMark } from "./feedback";
import { cx } from "./controls";

/**
 * The timetable (the "railway timetable" design): every job is one row with fixed columns, read sideways in a second.
 * The board row, the detail fact strip and the apply page all read their facts from `jobFacts`, so the
 * same job never says two different things in two places.
 */

export type JobFacts = {
  location: string;
  salary: string;
  salaryNegotiable: boolean;
  level: string | null;
  type: string | null;
  isNew: boolean;
  posted: string;
};

export function jobFacts(job: Job): JobFacts {
  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency);
  return {
    location: locationLabel(job.location),
    salary,
    salaryNegotiable: isSalaryNegotiable(job.salaryMin, job.salaryMax),
    level: job.experienceLevel ? experienceLevelLabel(job.experienceLevel, "") || null : null,
    type: job.employmentType ? employmentTypeLabel(job.employmentType, "") || null : null,
    isNew: isNewJob(job.createdAt),
    posted: timeAgo(job.createdAt),
  };
}

/** A missing fact is a dash on the board (the screen-reader text still says it). */
function Value({ value }: { value: string | null }) {
  const { t } = useTranslation();
  if (value) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true" className="jp-missing">
        —
      </span>
      <span className="jp-sr">{t("common.notProvided")}</span>
    </>
  );
}

export type SalarySort = "salary_desc" | "salary_asc" | undefined;

type BoardProps = {
  children: ReactNode;
  /** Current sort; the salary header toggles high→low, low→high. Leave out to render a static header. */
  sort?: string;
  onSalarySort?: (next: "salary_desc" | "salary_asc") => void;
  label?: string;
  className?: string;
};

export function Board({ children, sort, onSalarySort, label, className }: BoardProps) {
  const { t } = useTranslation();
  const salaryState = sort === "salary_desc" ? "desc" : sort === "salary_asc" ? "asc" : null;
  return (
    <div className={cx("jp-board", className)}>
      <div className="jp-board-head">
        <span>{t("board.position")}</span>
        <span className="jp-col--loc">{t("board.location")}</span>
        <span className="jp-col--salary">
          {onSalarySort ? (
            <button
              type="button"
              className="jp-board-sort"
              aria-label={
                salaryState === "desc"
                  ? t("board.salarySortedDesc")
                  : salaryState === "asc"
                    ? t("board.salarySortedAsc")
                    : t("board.salarySortable")
              }
              onClick={() => onSalarySort(salaryState === "desc" ? "salary_asc" : "salary_desc")}
            >
              {t("board.salary")}
              <Icon
                name={salaryState === "asc" ? "sortUp" : "sortDown"}
                size={16}
                className={salaryState ? "is-on" : undefined}
              />
            </button>
          ) : (
            t("board.salary")
          )}
        </span>
        <span className="jp-col--level">{t("board.level")}</span>
        <span className="jp-col--type">{t("board.type")}</span>
        <span className="jp-col--posted">{t("board.posted")}</span>
      </div>
      <ol className="jp-board-rows" aria-label={label ?? t("board.label")}>
        {children}
      </ol>
    </div>
  );
}

type RowProps = {
  job: Job;
  /** The row the visitor last opened: the one amber "your selection" band on the board. */
  selected?: boolean;
  onOpen?: (job: Job) => void;
  /** Render the title as text instead of a link (the apply page already is that job). */
  static?: boolean;
  /** One line under the company, e.g. the recommendation rationale. Nothing is rendered when absent. */
  note?: string;
};

export function JobRow({ job, selected, onOpen, static: isStatic, note }: RowProps) {
  const { t } = useTranslation();
  const f = jobFacts(job);
  const company = job.company?.name || t("common.notProvided");
  return (
    <li className={cx("jp-row", selected && "is-selected", isStatic && "is-static")}>
      <div className="jp-row-main">
        <h3 className="jp-row-title">
          {isStatic ? (
            job.title
          ) : (
            <Link to={`/jobs/${job.id}`} className="jp-row-link" onClick={() => onOpen?.(job)}>
              {job.title}
            </Link>
          )}
          {selected && <span className="jp-sr">{t("board.selected")}</span>}
        </h3>
        <p className="jp-row-company" title={company}>
          {company}
        </p>
        {note && <p className="jp-row-reason">{note}</p>}
        <p className="jp-row-sub" aria-hidden="true">
          {[f.type, f.isNew ? t("common.new") : f.posted].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="jp-cell jp-col--loc" title={f.location}>
        <span className="jp-sr">{t("board.srLocation")}</span>
        {f.location}
      </span>
      <span className={cx("jp-cell jp-col--salary", f.salaryNegotiable && "is-negotiable")}>
        <span className="jp-sr">{t("board.srSalary")}</span>
        {f.salary}
      </span>
      <span className="jp-cell jp-col--level">
        <span className="jp-sr">{t("board.srLevel")}</span>
        <Value value={f.level} />
      </span>
      <span className="jp-cell jp-col--type">
        <span className="jp-sr">{t("board.srType")}</span>
        <Value value={f.type} />
      </span>
      <span className="jp-cell jp-col--posted">
        <span className="jp-sr">{t("board.srPosted")}</span>
        {f.isNew ? <NewMark /> : f.posted || <Value value={null} />}
      </span>
    </li>
  );
}

/**
 * The detail page's facts: the board's columns (minus the title) as one header band and one row of
 * values, so list and detail line up visually and in content.
 */
export function FactStrip({ job }: { job: Job }) {
  const { t } = useTranslation();
  const f = jobFacts(job);
  const facts: [string, ReactNode, string?][] = [
    [t("board.location"), f.location, "loc"],
    [t("board.salary"), f.salary, "salary"],
    [t("board.level"), f.level ?? t("common.notProvided")],
    [t("board.type"), f.type ?? t("common.notProvided")],
    [t("board.posted"), f.isNew ? <NewMark key="new" /> : f.posted || t("common.notProvided")],
  ];
  return (
    <dl className="jp-facts">
      {facts.map(([term, value, mod]) => (
        <div
          key={term}
          className={cx("jp-fact", mod && `jp-fact--${mod}`, mod === "salary" && f.salaryNegotiable && "is-negotiable")}
        >
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
