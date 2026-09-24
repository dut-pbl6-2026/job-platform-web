import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { companyInitials, fetchJobs } from "../lib/jobsApi";
import type { Job, SearchFacets } from "../types/job";

const CATEGORY_META: Record<string, { label: string; icon: ReactNode }> = {
  IT: { label: "Công nghệ Thông tin", icon: <path d="M4 5h16v10H4zM2 19h20M9 15v4M15 15v4" /> },
  Sales: { label: "Kinh doanh/Bán hàng", icon: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" /> },
  Marketing: { label: "Marketing/PR/Quảng cáo", icon: <path d="M3 10v4h4l6 5V5L7 10zM17 9a4 4 0 0 1 0 6" /> },
  Finance: { label: "Tài chính/Ngân hàng", icon: <path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /> },
  Healthcare: { label: "Y tế/Dược", icon: <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" /> },
  Education: { label: "Giáo dục/Đào tạo", icon: <path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /> },
  Engineering: { label: "Kỹ thuật/Sản xuất", icon: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /> },
  Hospitality: { label: "Nhà hàng/Khách sạn", icon: <path d="M4 18h16M6 18a6 6 0 0 1 12 0M12 8V6M10 6h4" /> },
  Others: { label: "Ngành nghề khác", icon: <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" /> },
};

const BRAND_COVERS = [
  "linear-gradient(120deg,#00b14f,#0a5c34)",
  "linear-gradient(120deg,#0f6fff,#4fd2ff)",
  "linear-gradient(120deg,#f59e0b,#ef4444)",
  "linear-gradient(120deg,#7c3aed,#ec4899)",
  "linear-gradient(120deg,#0f172a,#334155)",
];

const BRANDS_PER_PAGE = 4;
const CATS_PER_PAGE = 8;

type Brand = { name: string; industry: string; verified: boolean; count: number };
type Industry = { value: string; count: number };

function summarize(jobs: Job[], facets?: SearchFacets) {
  const brands = new Map<string, Brand>();
  const industries = new Map<string, number>();
  for (const job of jobs) {
    const name = job.company?.name;
    if (name) {
      const cur = brands.get(name);
      if (cur) cur.count += 1;
      else brands.set(name, { name, industry: job.company.industry || job.category?.name || "", verified: !!job.company.verified, count: 1 });
    }
    const cat = job.category?.name;
    if (cat && !facets?.category?.length) industries.set(cat, (industries.get(cat) ?? 0) + 1);
  }
  for (const bucket of facets?.category ?? []) industries.set(bucket.value, bucket.count);
  for (const value of Object.keys(CATEGORY_META)) if (!industries.has(value)) industries.set(value, 0);
  return {
    brands: [...brands.values()].sort((a, b) => b.count - a.count),
    industries: [...industries.entries()].map(([value, count]) => ({ value, count }) as Industry).sort((a, b) => b.count - a.count),
  };
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <span className="topcv-section-pager">
      <button type="button" className="topcv-circle-btn" aria-label="Trang trước" disabled={page === 0} onClick={() => onPage(page - 1)}>‹</button>
      <button type="button" className="topcv-circle-btn topcv-circle-btn--green" aria-label="Trang sau" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>›</button>
    </span>
  );
}

export function HomeShowcase({ onCompany, onCategory }: { onCompany: (name: string) => void; onCategory: (value: string) => void }) {
  const [brandPage, setBrandPage] = useState(0);
  const [catPage, setCatPage] = useState(0);
  const statsQuery = useQuery({
    queryKey: ["home-stats"],
    queryFn: () => fetchJobs({ page: 0, size: 100 }),
  });

  const { brands, industries } = useMemo(() => summarize(statsQuery.data?.items ?? [], statsQuery.data?.facets), [statsQuery.data]);
  const brandPages = Math.max(1, Math.ceil(brands.length / BRANDS_PER_PAGE));
  const catPages = Math.max(1, Math.ceil(industries.length / CATS_PER_PAGE));
  const visibleBrands = brands.slice(brandPage * BRANDS_PER_PAGE, (brandPage + 1) * BRANDS_PER_PAGE);
  const visibleCats = industries.slice(catPage * CATS_PER_PAGE, (catPage + 1) * CATS_PER_PAGE);

  if (statsQuery.isPending || statsQuery.isError) return null;

  return (
    <>
      {brands.length > 0 && (
        <section className="home-brands">
          <div className="container">
            <div className="topcv-section-head">
              <h2 className="topcv-section-title">Thương hiệu lớn tiêu biểu</h2>
              <span className="topcv-section-sub">Những doanh nghiệp đang tuyển dụng nhiều nhất</span>
              <span className="topcv-head-spacer" />
              <Pager page={brandPage} pages={brandPages} onPage={setBrandPage} />
            </div>
            <div className="topcv-brand-grid">
              {visibleBrands.map((brand, i) => (
                <button key={brand.name} type="button" className="topcv-brand-card" onClick={() => onCompany(brand.name)}>
                  <div className="topcv-brand-cover" style={{ background: BRAND_COVERS[(brandPage * BRANDS_PER_PAGE + i) % BRAND_COVERS.length] }}>
                    <span className="topcv-brand-top">Top</span>
                  </div>
                  <div className="topcv-brand-body">
                    <div className="topcv-brand-logo">{companyInitials(brand.name)}</div>
                    <div className="topcv-brand-name">
                      {brand.name}
                      {brand.verified && <span className="topcv-verify" title="Công ty đã xác thực">✓</span>}
                    </div>
                    <div className="topcv-brand-industry">{CATEGORY_META[brand.industry]?.label ?? brand.industry}</div>
                    <div className="topcv-brand-count">{brand.count} việc làm đang tuyển</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="home-industries">
        <div className="container">
          <div className="topcv-section-head">
            <h2 className="topcv-section-title">Top ngành nghề nổi bật</h2>
            <span className="topcv-section-sub">Bạn muốn tìm việc mới? Xem danh sách việc làm theo ngành</span>
            <span className="topcv-head-spacer" />
            <Pager page={catPage} pages={catPages} onPage={setCatPage} />
          </div>
          <div className="topcv-industry-grid">
            {visibleCats.map((cat) => {
              const meta = CATEGORY_META[cat.value];
              return (
                <button key={cat.value} type="button" className="topcv-industry-card" onClick={() => onCategory(cat.value)}>
                  <span className="topcv-industry-icon">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {meta?.icon ?? CATEGORY_META.Others.icon}
                    </svg>
                  </span>
                  <span className="topcv-industry-name">{meta?.label ?? cat.value}</span>
                  <span className="topcv-industry-count">{cat.count.toLocaleString("vi-VN")} việc làm</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
