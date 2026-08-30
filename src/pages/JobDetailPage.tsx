import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { fetchJobById, formatSalary, timeAgo } from "../lib/jobsApi";
import type { Job } from "../types/job";
import { AppHeader } from "../components/AppHeader";
import { useAuth } from "../contexts/AuthContext";
import { isRecruiter, isUser } from "../lib/roles";

export default function JobDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setErr(null);
    setJob(null);
    fetchJobById(id)
      .then((j) => { if (alive) { if (!j) setErr("Việc làm không tồn tại"); else setJob(j); } })
      .catch((e) => { if (alive) setErr(e?.message || "Load failed"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) return (<><AppHeader /><div className="container"><div className="skeleton-detail" /></div></>);
  if (err) return (<><AppHeader /><div className="container"><div className="alert alert-error">{err}</div><Link to="/jobs" className="btn btn-ghost">← Quay lại danh sách</Link></div></>);
  if (!job) return null;

  const isOwner = isAuthenticated && user && job.recruiterId && user.id === job.recruiterId;
  const canApply = isAuthenticated && isUser(user?.role);
  const isEmployer = isRecruiter(user?.role); // canonical Recruiter; Employer alias handled via normalizeRole

  return (
    <>
      <AppHeader />
      <div className="container detail-layout">
        <div className="detail-main">
          <Link to="/jobs" className="hint detail-back">← Quay lại</Link>
          <div className="card">
            <div className="job-detail-head">
              <div className="job-logo lg">{job.company.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <h1 className="detail-title">{job.title}</h1>
                <div className="hint">{job.company.name} • {job.location} • {timeAgo(job.createdAt)}</div>
                <div className="job-tags detail-job-tags">
                  <span className="tag">{job.category.name}</span>
                  <span className="tag">{job.employmentType}</span>
                  <span className="tag">{job.experienceLevel}</span>
                </div>
              </div>
            </div>
            <div className="detail-salary">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</div>

            <div className="detail-actions">
              {canApply && <button className="btn btn-primary" onClick={() => nav(`/jobs/${job.id}/apply`)}>Ứng tuyển ngay</button>}
              {!isAuthenticated && <Link className="btn btn-primary" to="/login">Đăng nhập để ứng tuyển</Link>}
              {isEmployer && isOwner && <Link className="btn btn-ghost" to={`/jobs/${job.id}/edit`}>Chỉnh sửa</Link>}
              {isEmployer && !isOwner && <span className="hint">Bạn không sở hữu tin này</span>}
            </div>

            <div className="detail-section">
              <h3>Mô tả công việc</h3>
              <p className="detail-prewrap">{job.description || "Chưa cập nhật"}</p>
            </div>
            <div className="detail-section">
              <h3>Yêu cầu</h3>
              <p className="detail-prewrap">{job.requirements?.trim() ? job.requirements : "Chưa cập nhật"}</p>
            </div>
            <div className="detail-section">
              <h3>Quyền lợi</h3>
              <p className="detail-prewrap">{job.benefits?.trim() ? job.benefits : "Chưa cập nhật"}</p>
            </div>
            <div className="hint">Lượt xem: {job.viewCount} • Cập nhật: {new Date(job.updatedAt).toLocaleDateString("vi-VN")}</div>
          </div>
        </div>
        <aside className="detail-side">
          <div className="card">
            <h3 className="detail-company-name">Công ty</h3>
            <div className="detail-company-head">{job.company.name} {job.company.verified && <span className="badge-verify">✓ Verified</span>}</div>
            <div className="hint">{job.company.industry} • {job.company.address}</div>
            {job.company.website && <a href={job.company.website} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{job.company.website}</a>}
            <div className="detail-company-meta">Mã công ty: <code>{job.companyId}</code></div>
          </div>
          <div className="card detail-side-card">
            <h4 className="detail-side-title">Thông tin chung</h4>
            <div className="kv"><span>Địa điểm</span><strong>{job.location}</strong></div>
            <div className="kv"><span>Danh mục</span><strong>{job.category.name}</strong></div>
            <div className="kv"><span>Loại hình</span><strong>{job.employmentType}</strong></div>
            <div className="kv"><span>Kinh nghiệm</span><strong>{job.experienceLevel}</strong></div>
            <div className="kv"><span>Trạng thái</span><strong>{job.status}</strong></div>
          </div>
        </aside>
      </div>
    </>
  );
}
