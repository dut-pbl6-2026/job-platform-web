import { Link } from "react-router-dom";
import type { Job } from "../types/job";
import { formatSalary, timeAgo } from "../lib/jobsApi";

export function JobCard({ job }: { job: Job }) {
  return (
    <Link to={`/jobs/${job.id}`} className="job-card">
      <div className="job-card-head">
        <div className="job-logo">{job.company.name.slice(0, 2).toUpperCase()}</div>
        <div className="job-meta">
          <h3 className="job-title">{job.title}</h3>
          <div className="job-company">{job.company.name} {job.company.verified && <span className="badge-verify">✓ Verified</span>}</div>
        </div>
      </div>
      <div className="job-tags">
        <span className="tag">{job.location}</span>
        <span className="tag">{job.category.name}</span>
        <span className="tag">{job.employmentType}</span>
        <span className="tag">{job.experienceLevel}</span>
      </div>
      <div className="job-desc">{job.description.slice(0, 110)}...</div>
      <div className="job-foot">
        <span className="job-salary">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span>
        <span className="job-time">{timeAgo(job.createdAt)} • {job.viewCount} views</span>
      </div>
    </Link>
  );
}
