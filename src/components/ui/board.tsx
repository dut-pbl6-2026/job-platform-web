import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Job } from "../../types/job";
import { formatSalary, isNewJob, timeAgo } from "../../lib/jobsApi";
import { employmentTypeLabel, experienceLevelLabel, locationLabel } from "../../lib/labels";
import { Icon } from "./Icon";
import { NewMark } from "./feedback";
import { cx } from "./controls";

/**
 * The timetable ("Bảng giờ tàu"): every job is one row with fixed columns, read sideways in a second.
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
    salaryNegotiable: salary === "Thỏa thuận",
    level: job.experienceLevel ? experienceLevelLabel(job.experienceLevel, "") || null : null,
    type: job.employmentType ? employmentTypeLabel(job.employmentType, "") || null : null,
    isNew: isNewJob(job.createdAt),
    posted: timeAgo(job.createdAt),
  };
}

const MISSING = "Chưa cập nhật";

/** A missing fact is a dash on the board (the screen-reader text still says it). */
function Value({ value }: { value: string | null }) {
  if (value) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true" className="jp-missing">—</span>
      <span className="jp-sr">{MISSING}</span>
    </>
  );
}

export type SalarySort = "salary_desc" | "salary_asc" | undefined;

type BoardProps = {
  children: ReactNode;
  /** Current sort; the Lương header toggles high→low, low→high. Leave out to render a static header. */
  sort?: string;
  onSalarySort?: (next: "salary_desc" | "salary_asc") => void;
  label?: string;
  className?: string;
};

export function Board({ children, sort, onSalarySort, label = "Bảng việc làm", className }: BoardProps) {
  const salaryState = sort === "salary_desc" ? "desc" : sort === "salary_asc" ? "asc" : null;
  return (
    <div className={cx("jp-board", className)}>
      <div className="jp-board-head">
        <span>Vị trí · Công ty</span>
        <span className="jp-col--loc">Nơi làm</span>
        <span className="jp-col--salary">
          {onSalarySort ? (
            <button
              type="button"
              className="jp-board-sort"
              aria-label={
                salaryState === "desc"
                  ? "Lương, đang xếp cao đến thấp. Bấm để xếp thấp đến cao"
                  : salaryState === "asc"
                    ? "Lương, đang xếp thấp đến cao. Bấm để xếp cao đến thấp"
                    : "Lương. Bấm để xếp cao đến thấp"
              }
              onClick={() => onSalarySort(salaryState === "desc" ? "salary_asc" : "salary_desc")}
            >
              Lương
              <Icon name={salaryState === "asc" ? "sortUp" : "sortDown"} size={16} className={salaryState ? "is-on" : undefined} />
            </button>
          ) : (
            "Lương"
          )}
        </span>
        <span className="jp-col--level">Cấp bậc</span>
        <span className="jp-col--type">Hình thức</span>
        <span className="jp-col--posted">Đăng</span>
      </div>
      <ol className="jp-board-rows" aria-label={label}>
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
};

export function JobRow({ job, selected, onOpen, static: isStatic }: RowProps) {
  const f = jobFacts(job);
  const company = job.company?.name || MISSING;
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
          {selected && <span className="jp-sr"> (bạn vừa xem)</span>}
        </h3>
        <p className="jp-row-company" title={company}>{company}</p>
        <p className="jp-row-sub" aria-hidden="true">
          {[f.type, f.isNew ? "Mới" : f.posted].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="jp-cell jp-col--loc" title={f.location}>
        <span className="jp-sr">Nơi làm: </span>
        {f.location}
      </span>
      <span className={cx("jp-cell jp-col--salary", f.salaryNegotiable && "is-negotiable")}>
        <span className="jp-sr">Lương: </span>
        {f.salary}
      </span>
      <span className="jp-cell jp-col--level">
        <span className="jp-sr">Cấp bậc: </span>
        <Value value={f.level} />
      </span>
      <span className="jp-cell jp-col--type">
        <span className="jp-sr">Hình thức: </span>
        <Value value={f.type} />
      </span>
      <span className="jp-cell jp-col--posted">
        <span className="jp-sr">Đăng: </span>
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
  const f = jobFacts(job);
  const facts: [string, ReactNode, string?][] = [
    ["Nơi làm", f.location, "loc"],
    ["Lương", f.salary, "salary"],
    ["Cấp bậc", f.level ?? MISSING],
    ["Hình thức", f.type ?? MISSING],
    ["Đăng", f.isNew ? <NewMark /> : f.posted || MISSING],
  ];
  return (
    <dl className="jp-facts">
      {facts.map(([term, value, mod]) => (
        <div key={term} className={cx("jp-fact", mod && `jp-fact--${mod}`, mod === "salary" && f.salaryNegotiable && "is-negotiable")}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
