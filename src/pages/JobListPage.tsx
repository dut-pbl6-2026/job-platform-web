import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCategories, fetchJobs } from "../lib/jobsApi";
import type { PaginatedJobs } from "../types/job";
import { JobCard } from "../components/JobCard";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { AppHeader } from "../components/AppHeader";

// SRS SEARCH-01-04: page 0-based, size 1..100, default 20 (server)
const JOB_PAGE_SIZE = 9;

// Fallback chips if API not yet available — must include all 9 backend seeded categories
const FALLBACK_CATS = ["", "IT", "Finance", "Marketing", "Healthcare", "Education", "Engineering", "Sales", "Hospitality", "Others"];

// Hero categories like TopCV left panel (display label -> backend category value)
const HERO_CATS: { label: string; value: string }[] = [
  { label: "Kinh doanh/Bán hàng", value: "Sales" },
  { label: "Marketing/PR/Quảng cáo", value: "Marketing" },
  { label: "Chăm sóc khách hàng (Custome...", value: "Others" },
  { label: "Nhân sự/Hành chính/Pháp chế", value: "Healthcare" },
  { label: "Công nghệ Thông tin", value: "IT" },
  { label: "Lao động phổ thông", value: "Engineering" },
];

const LOC_PILLS = ["Tất cả", "Hà Nội", "Thành phố Hồ Chí Minh (cũ)", "Miền Bắc", "Miền Nam"];

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
  const [activeTab, setActiveTab] = useState<"vanphong" | "phothong">("vanphong");
  const [heroPage, setHeroPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setCatsLoading(true); setCatsErr(null);
    fetchCategories()
      .then((list) => {
        if (!alive) return;
        if (Array.isArray(list) && list.length > 0) {
          const names = [...new Set(list.map((c) => c.name).filter(Boolean))];
          const merged = ["", ...names];
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
      {/* TopCV Hero */}
      <div className="topcv-hero">
        <div className="container" style={{ position: "relative", paddingTop: 18, paddingBottom: 28 }}>
          <h1 className="topcv-hero-title">TopCV - Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả</h1>
          <div className="topcv-search-wrap">
            <SearchBar initialQ={q} initialLoc={location} onSearch={(nq, nloc) => update({ q: nq, location: nloc, page: "0" })} />
          </div>

        

          {/* carousel dots */}
          <div className="topcv-dots">
            <span className="topcv-dot" />
            <span className="topcv-dot active" />
            <span className="topcv-dot" />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 18 }}>
       

        {/* Filter bar */}
        <div className="topcv-filter-bar">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="topcv-filter-label">Lọc theo:</span>
            <div className="topcv-filter-select">
              <span>Địa điểm</span>
              <span>▾</span>
            </div>
            <button className="topcv-circle-btn topcv-circle-btn--light">‹</button>
            <div className="topcv-pills">
              {LOC_PILLS.map((lp) => {
                const isActive = (lp === "Tất cả" && !location) || location === lp;
                const nextLoc = lp === "Tất cả" ? "" : lp;
                return (
                  <button
                    key={lp}
                    className={`topcv-pill ${isActive ? "active" : ""}`}
                    onClick={() => update({ location: nextLoc, page: "0" })}
                  >
                    {lp}
                  </button>
                );
              })}
            </div>
            <button className="topcv-circle-btn topcv-circle-btn--light">›</button>
          </div>
        </div>

        {/* Hidden original cats for API fallback debug (keep functionality) */}
        {catsErr && <div className="hint" style={{ margin: "8px 0", color: "#dc2626" }}>Lỗi danh mục <button className="chip" onClick={retryCats}>Thử lại</button></div>}
        {catsLoading && <div className="hint" style={{ margin: "8px 0" }}>Đang tải danh mục…</div>}

        {/* Hint bar */}
        <div className="topcv-hint">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#00b14f", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>Gợi ý:</span>
            Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết
          </span>
          <button className="topcv-hint-close" onClick={(e) => ((e.target as HTMLElement).parentElement!.style.display = "none")}>×</button>
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
            <div className="topcv-grid">
              {data.items.map((j, idx) => <JobCard key={j.id} job={j} index={idx} />)}
            </div>
            {/* TopCV pagination like image: circles + 12 / 111 trang */}
            <div className="topcv-pagination">
              <button className="topcv-circle-btn" onClick={() => update({ page: String(Math.max(0, page - 1)) })}>‹</button>
              <span className="topcv-page-info">{page + 1} / {data.totalPages} trang</span>
              <button className="topcv-circle-btn topcv-circle-btn--green" onClick={() => update({ page: String(Math.min(data.totalPages - 1, page + 1)) })}>›</button>
            </div>
            <div style={{ marginTop: 10 }}>
              <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ page: String(p) })} />
              <div className="hint" style={{ textAlign: "center", marginTop: 6 }}>{cats.slice(1, 6).join(" • ")} • Trang {data.page + 1}/{data.totalPages} — Tổng {data.total} việc</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
