import { Link } from "react-router-dom";
import type { Job } from "../types/job";
import { formatSalary } from "../lib/jobsApi";

export function JobCard({ job, index = 0 }: { job: Job; index?: number }) {
  const isHot = index % 3 === 0;
  const isTop = !isHot && index % 2 === 0;
  const badge = isHot ? "HOT" : isTop ? "TOP" : null;
  const badgeClass = isHot ? "badge-hot" : "badge-top";
  const salaryLabel = job.salaryMin || job.salaryMax ? formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency) : "Thỏa thuận";
  const locNew = `${job.location} (mới)`;

  return (
    <Link to={`/jobs/${job.id}`} className={`topcv-card ${isTop ? "topcv-card--top" : ""}`}>
      {badge && <span className={`topcv-badge ${badgeClass}`}>{badge}</span>}
      <div className="topcv-card-head">
        <div className="topcv-logo">{job.company.name.slice(0, 2).toUpperCase()}</div>
        <div className="topcv-meta">
          <h3 className="topcv-title" title={job.title}>{job.title}</h3>
          <div className="topcv-company">{job.company.name.toUpperCase()}</div>
        </div>
      </div>
      <div className="topcv-foot">
        <span className="topcv-tag topcv-tag--salary">{salaryLabel.includes("Thỏa") ? "Thỏa thuận" : salaryLabel}</span>
        <span className="topcv-tag topcv-tag--loc">{locNew}</span>
        <span className="topcv-check">✓</span>
      </div>
      {/* keep hidden tags for accessibility */}
      <span style={{ display: "none" }}>{job.category.name} {job.employmentType}</span>
    </Link>
  );
}
