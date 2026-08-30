import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchJobs } from "../lib/jobsApi";
import type { PaginatedJobs } from "../types/job";
import { JobCard } from "../components/JobCard";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { AppHeader } from "../components/AppHeader";

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
    fetchJobs({ q, location, category: category || undefined, page, size: 9 })
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
