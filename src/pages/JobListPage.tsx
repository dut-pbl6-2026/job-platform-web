import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchJobs } from "../lib/jobsApi";
import { JobCard } from "../components/JobCard";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { AppHeader } from "../components/AppHeader";
import { AdvancedFilters } from "../components/AdvancedFilters";
import { HomeShowcase } from "../components/HomeShowcase";
import { parseSearchParams, hasActiveFilters } from "../lib/searchFilters";
import { queryKeys } from "../lib/queryClient";

const FALLBACK_CATS = ["IT", "Finance", "Marketing", "Healthcare", "Education", "Engineering", "Sales", "Hospitality", "Others"];

const HERO_CATS: { label: string; value: string }[] = [
  { label: "Kinh doanh/Bán hàng", value: "Sales" },
  { label: "Marketing/PR/Quảng cáo", value: "Marketing" },
  { label: "Chăm sóc khách hàng", value: "Others" },
  { label: "Nhân sự/Hành chính/Pháp chế", value: "Healthcare" },
  { label: "Công nghệ Thông tin", value: "IT" },
  { label: "Lao động phổ thông", value: "Engineering" },
  { label: "Tài chính/Ngân hàng", value: "Finance" },
  { label: "Giáo dục/Đào tạo", value: "Education" },
  { label: "Nhà hàng/Khách sạn", value: "Hospitality" },
];

const OFFICE_CATS = new Set(["IT", "Finance", "Marketing", "Education", "Sales", "Healthcare"]);
const LABOR_CATS = new Set(["Engineering", "Hospitality", "Others"]);

const BANNERS = [
  {
    kicker: "Cơ hội việc làm mới",
    title: "Tìm việc phù hợp, ứng tuyển trong vài phút",
    points: ["Hồ sơ một lần", "Gợi ý theo kỹ năng", "Theo dõi trạng thái"],
    cta: "Khám phá ngay",
  },
  {
    kicker: "Nhà tuyển dụng",
    title: "Đăng tin và tiếp cận ứng viên chất lượng",
    points: ["Lọc hồ sơ nhanh", "Quản lý tin tuyển", "Phản hồi tức thì"],
    cta: "Đăng tin tuyển dụng",
  },
  {
    kicker: "Job Platform",
    title: "Kết nối người tìm việc và doanh nghiệp",
    points: ["Tìm theo lương", "Lọc kinh nghiệm", "Việc làm Remote"],
    cta: "Bắt đầu tìm việc",
  },
];

export default function JobListPage() {
  const [sp, setSp] = useSearchParams();
  const params = parseSearchParams(sp);
  const [heroPage, setHeroPage] = useState(0);
  const [banner, setBanner] = useState(0);
  const [tab, setTab] = useState<"office" | "labor">("office");
  const [hintOpen, setHintOpen] = useState(true);

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs(params),
    queryFn: () => fetchJobs(params),
  });

  const catsQuery = useQuery({
    queryKey: queryKeys.categories,
    queryFn: fetchCategories,
  });

  const data = jobsQuery.data;
  const loading = jobsQuery.isPending;
  const err = jobsQuery.error instanceof Error ? jobsQuery.error.message : jobsQuery.isError ? "Load failed" : null;
  const names = (catsQuery.data ?? []).map((c) => c.name).filter(Boolean);
  const mergedCats = [...new Set([...names, ...FALLBACK_CATS])];
  const catPages = Math.max(1, Math.ceil(HERO_CATS.length / 6));
  const visibleCats = HERO_CATS.slice(heroPage * 6, heroPage * 6 + 6);
  const slide = BANNERS[banner];

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const allow = tab === "office" ? OFFICE_CATS : LABOR_CATS;
    const filtered = list.filter((job) => allow.has(job.category?.name));
    return filtered.length ? filtered : list;
  }, [data, tab]);

  function update(next: Record<string, string | undefined>) {
    const n = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (v == null || v === "") n.delete(k);
      else n.set(k, v);
    });
    if (!("page" in next)) n.set("page", "0");
    if (n.get("page") === "0") n.delete("page");
    setSp(n, { replace: false });
  }

  function pickAndScroll(next: Record<string, string | undefined>) {
    update(next);
    document.getElementById("home-jobs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setSp(params.q ? { q: params.q } : {}, { replace: false });
  }

  return (
    <div className="home-shell">
      <AppHeader />
      <section className="topcv-hero">
        <div className="container topcv-hero-inner">
          <h1 className="topcv-hero-title">Job Platform — Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả</h1>
          <div className="topcv-search-wrap">
            <SearchBar initialQ={params.q || ""} initialLoc={params.location || ""} onSearch={(nq, nloc) => update({ q: nq || undefined, location: nloc || undefined })} />
          </div>

          <div className="topcv-hero-row">
            <div className="topcv-hero-cats">
              <div className="topcv-cat-list">
                {visibleCats.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`topcv-cat-item ${params.category === cat.value ? "active" : ""}`}
                    onClick={() => update({ category: params.category === cat.value ? undefined : cat.value })}
                  >
                    <span>{cat.label}</span>
                    <span className="topcv-cat-arrow">›</span>
                  </button>
                ))}
              </div>
              <div className="topcv-cat-footer">
                <span>{heroPage + 1}/{catPages}</span>
                <span className="topcv-cat-pager">
                  <button type="button" className="topcv-circle-btn" disabled={heroPage === 0} onClick={() => setHeroPage((p) => Math.max(0, p - 1))}>‹</button>
                  <button type="button" className="topcv-circle-btn topcv-circle-btn--green" disabled={heroPage >= catPages - 1} onClick={() => setHeroPage((p) => Math.min(catPages - 1, p + 1))}>›</button>
                </span>
              </div>
            </div>

            <div className="topcv-hero-banner">
              <button type="button" className="topcv-banner-nav left" aria-label="Banner trước" onClick={() => setBanner((i) => (i + BANNERS.length - 1) % BANNERS.length)}>‹</button>
              <div className="topcv-banner-copy">
                <p className="topcv-banner-kicker">{slide.kicker}</p>
                <h2>{slide.title}</h2>
                <ul>
                  {slide.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
                <Link className="topcv-banner-cta" to="/jobs">{slide.cta} →</Link>
              </div>
              <div className="topcv-banner-art" aria-hidden="true" />
              <button type="button" className="topcv-banner-nav right" aria-label="Banner sau" onClick={() => setBanner((i) => (i + 1) % BANNERS.length)}>›</button>
            </div>
          </div>

          <div className="topcv-dots">
            {BANNERS.map((_, i) => <span key={i} className={`topcv-dot ${i === banner ? "active" : ""}`} />)}
          </div>
        </div>
      </section>

      <section className="home-jobs" id="home-jobs">
        <div className="container">
          <div className="topcv-section-head">
            <h2 className="topcv-section-title">Việc làm nổi bật</h2>
            <div className="topcv-tabs">
              <button type="button" className={`topcv-tab ${tab === "office" ? "active" : ""}`} onClick={() => setTab("office")}>Việc văn phòng</button>
              <button type="button" className={`topcv-tab ${tab === "labor" ? "active" : ""}`} onClick={() => setTab("labor")}>Việc phổ thông</button>
            </div>
            <Link className="topcv-viewall" to="/jobs">Xem tất cả</Link>
            <span className="topcv-section-pager">
              <button type="button" className="topcv-circle-btn" disabled={!data || data.page === 0} onClick={() => update({ page: String(Math.max(0, (data?.page ?? 0) - 1)) })}>‹</button>
              <button type="button" className="topcv-circle-btn topcv-circle-btn--green" disabled={!data || data.page >= data.totalPages - 1} onClick={() => update({ page: String((data?.page ?? 0) + 1) })}>›</button>
            </span>
          </div>

          <AdvancedFilters
            params={params}
            facets={data?.facets}
            categories={mergedCats}
            onChange={update}
            onClear={clearFilters}
          />

          {catsQuery.isError && (
            <div className="hint" style={{ margin: "8px 0", color: "#dc2626" }}>
              Lỗi danh mục <button className="chip" onClick={() => void catsQuery.refetch()}>Thử lại</button>
            </div>
          )}

          {hintOpen && (
            <div className="topcv-hint">
              <span>
                <span className="topcv-hint-tag">Gợi ý:</span>
                Di chuột vào tiêu đề việc làm để xem thêm thông tin chi tiết
              </span>
              <button className="topcv-hint-close" type="button" onClick={() => setHintOpen(false)}>×</button>
            </div>
          )}

          {loading && <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>}
          {err && <div className="alert alert-error">{err}</div>}
          {data && !loading && items.length === 0 && (
            <div className="empty">
              <h3>Không tìm thấy việc phù hợp</h3>
              <p className="hint">Thử bỏ bộ lọc hoặc tìm từ khóa khác.</p>
              {hasActiveFilters(params) && <button className="btn btn-ghost" onClick={clearFilters}>Xóa bộ lọc</button>}
            </div>
          )}
          {data && !loading && items.length > 0 && (
            <>
              <div className="topcv-grid">
                {items.map((j, idx) => <JobCard key={j.id} job={j} index={idx} />)}
              </div>
              <div className="topcv-pagination">
                <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ page: String(p) })} />
                <div className="topcv-page-info">Trang {data.page + 1} / {data.totalPages}</div>
              </div>
            </>
          )}
        </div>
      </section>

      <HomeShowcase
        onCompany={(name) => pickAndScroll({ q: name })}
        onCategory={(value) => pickAndScroll({ category: value })}
      />
    </div>
  );
}
