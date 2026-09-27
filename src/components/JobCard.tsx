import { Link } from "react-router-dom";
import type { Job } from "../types/job";
import { companyInitials, formatSalaryShort } from "../lib/jobsApi";

export function JobCard({ job, index = 0 }: { job: Job; index?: number }) {
  const kind = index % 5;
  const badge = kind === 0 ? "GẤP" : kind === 1 ? "HOT" : kind === 2 ? "TIN MỚI" : null;
  const badgeClass = kind === 0 ? "badge-gap" : kind === 1 ? "badge-hot" : "badge-new";
  const salaryLabel = formatSalaryShort(job.salaryMin, job.salaryMax, job.salaryCurrency);
  const snippet = (job.description || "").replace(/\s+/g, " ").slice(0, 160);

  return (
    <Link to={`/jobs/${job.id}`} className="topcv-card">
      <div className="topcv-card-head">
        <div className="topcv-logo-wrap">
          {badge && <span className={`topcv-badge ${badgeClass}`}>{badge}</span>}
          <div className="topcv-logo">{companyInitials(job.company.name)}</div>
        </div>
        <div className="topcv-meta">
          <h3 className="topcv-title" title={job.title}>{job.title}</h3>
          <div className="topcv-company">
            {job.company.name}
            {job.company.verified ? <span className="topcv-verify" title="Công ty đã xác thực">✓</span> : null}
          </div>
        </div>
      </div>
      <div className="topcv-foot">
        <span className="topcv-tag topcv-tag--salary">{salaryLabel}</span>
        <span className="topcv-tag topcv-tag--loc">{job.location}</span>
        <span className="topcv-check" aria-hidden="true">✓</span>
      </div>
      <div className="topcv-hover" aria-hidden="true">
        <p className="topcv-hover-kicker">{job.company.name}</p>
        <h4>{job.title}</h4>
        <p className="topcv-hover-desc">{snippet}{snippet.length >= 160 ? "…" : ""}</p>
        {job.skills && job.skills.length > 0 && (
          <div className="topcv-hover-skills">
            {job.skills.slice(0, 4).map((skill) => (
              <span key={skill}>{skill}</span>
            ))}
          </div>
        )}
        <div className="topcv-hover-meta">
          <span>{salaryLabel}</span>
          <span>{job.location}</span>
          <span>{job.employmentType}</span>
        </div>
      </div>
      <span className="sr-only">{job.category.name} {job.employmentType}</span>
    </Link>
  );
}
