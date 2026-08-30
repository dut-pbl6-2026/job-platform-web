import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCategories, fetchJobs } from "../lib/jobsApi";
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

// Fallback chips if API not yet available — must include all 9 backend seeded categories
const FALLBACK_CATS = ["", "IT", "Finance", "Marketing", "Healthcare", "Education", "Engineering", "Sales", "Hospitality", "Others"];

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
  const [cats, setCats] = useState<string[]>(FALLBACK_CATS);
  const [catsLoading, setCatsLoading] = useState(true);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setCatsLoading(true); setCatsErr(null);
    fetchCategories()
      .then((list) => {
        if (!alive) return;
        if (Array.isArray(list) && list.length > 0) {
          // deduplicate by name, keep fallback order if API incomplete
          const names = [...new Set(list.map((c) => c.name).filter(Boolean))];
          // Ensure missing seeded categories still appear (Sales, Hospitality, Others)
          const merged = ["", ...names];
          // Add any missing from fallback
          for (const f of FALLBACK_CATS) if (f && !merged.includes(f)) merged.push(f);
          setCats(merged);
        }
      })
      .catch((e) => { if (alive) setCatsErr(e?.message || "Load categories failed"); })
      .finally(() => { if (alive) setCatsLoading(false); });
    return () => { alive = false; };
  }, []);

  function retryCats() {
    setCatsLoading(true); setCatsErr(null);
    fetchCategories()
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const names = [...new Set(list.map((c) => c.name).filter(Boolean))];
          const merged = ["", ...names];
          for (const f of FALLBACK_CATS) if (f && !merged.includes(f)) merged.push(f);
          setCats(merged);
        }
      })
      .catch((e) => setCatsErr(e?.message || "Load categories failed"))
      .finally(() => setCatsLoading(false));
  }

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
            {cats.map((c) => (
              <button key={c || "all"} className={`chip ${category === c ? "chip-active" : ""}`} onClick={() => update({ category: c, page: "0" })}>{c || "Tất cả"}</button>
            ))}
            {catsLoading && <span className="hint" style={{ alignSelf: "center" }}>Đang tải danh mục…</span>}
            {catsErr && <><span className="hint" style={{ color: "#dc2626", alignSelf: "center" }}>Lỗi danh mục</span><button className="chip" onClick={retryCats}>Thử lại</button></>}
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
