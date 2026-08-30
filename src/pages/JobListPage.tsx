import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchJobs } from "../lib/jobsApi";
import type { PaginatedJobs } from "../types/job";
import { JobCard } from "../components/JobCard";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { AppHeader } from "../components/AppHeader";

// SRS SEARCH-01-04: page 0-based, size 1..100, default 20 (server)
// Design choice: size=9 fits 3-col grid (3x3) on desktop, still within 1..100 spec.
// Server default 20 vẫn tôn trọng nếu client không gửi size; client chọn 9 để tối ưu UI.
// Đổi thành 20 chỉ cần sửa JOB_PAGE_SIZE.
const JOB_PAGE_SIZE = 9;

const CATS = ["", "IT", "Finance", "Marketing", "Healthcare", "Education", "Engineering"];

export default function JobListPage() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const location = sp.get("location") || "";
  const category = sp.get("category") || "";
  const pageParam = Number(sp.get("page"));
  const page = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    fetchJobs({ q, location, category: category || undefined, page, size: JOB_PAGE_SIZE })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(e.message || "Load failed"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [q, location, category, page]);

  function update(next: Record<string, string>) {
    const n = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (!v) n.delete(k); else n.set(k, v);
    });
    setSp(n, { replace: false });
  }

  return (
    <>
      <AppHeader />
      <div className="container">
        <div className="hero">
          <h1>Tìm việc mơ ước</h1>
          <p>{data ? `${data.total} việc làm đang tuyển` : "Kết nối ứng viên & nhà tuyển dụng"} — SRS WEB-01-02 / SEARCH-01</p>
          <SearchBar initialQ={q} initialLoc={location} onSearch={(nq, nloc) => update({ q: nq, location: nloc, page: "0" })} />
          <div className="filter-row">
            {CATS.map((c) => (
              <button key={c || "all"} className={`chip ${category === c ? "chip-active" : ""}`} onClick={() => update({ category: c, page: "0" })}>{c || "Tất cả"}</button>
            ))}
          </div>
        </div>

        {loading && <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>}
        {err && <div className="alert alert-error">{err}</div>}
        {data && !loading && data.items.length === 0 && (
          <div className="empty">
            <h3>Không tìm thấy việc phù hợp</h3>
            <p className="hint">Thử bỏ bộ lọc hoặc tìm từ khóa khác.</p>
          </div>
        )}
        {data && !loading && data.items.length > 0 && (
          <>
            <div className="job-grid">
              {data.items.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ page: String(p) })} />
            <div className="hint" style={{ textAlign: "center", marginTop: 12 }}>Trang {data.page + 1}/{data.totalPages} — Tổng {data.total} việc</div>
          </>
        )}
      </div>
    </>
  );
}
