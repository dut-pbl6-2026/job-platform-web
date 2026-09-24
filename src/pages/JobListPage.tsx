import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchJobs } from "../lib/jobsApi";
import { JobCard } from "../components/JobCard";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { AppHeader } from "../components/AppHeader";
import { AdvancedFilters } from "../components/AdvancedFilters";
import { parseSearchParams, hasActiveFilters } from "../lib/searchFilters";
import { queryKeys } from "../lib/queryClient";

const FALLBACK_CATS = ["", "IT", "Finance", "Marketing", "Healthcare", "Education", "Engineering", "Sales", "Hospitality", "Others"];

export default function JobListPage() {
  const [sp, setSp] = useSearchParams();
  const params = parseSearchParams(sp);

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
  const mergedCats = [...new Set([...names, ...FALLBACK_CATS.filter(Boolean)])];

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

  function clearFilters() {
    setSp(params.q ? { q: params.q } : {}, { replace: false });
  }

  return (
    <>
      <AppHeader />
      <div className="topcv-hero">
        <div className="container" style={{ position: "relative", paddingTop: 18, paddingBottom: 28 }}>
          <h1 className="topcv-hero-title">TopCV - Tạo CV, Tìm việc làm, Tuyển dụng hiệu quả</h1>
          <div className="topcv-search-wrap">
            <SearchBar initialQ={params.q || ""} initialLoc={params.location || ""} onSearch={(nq, nloc) => update({ q: nq || undefined, location: nloc || undefined })} />
          </div>
          <div className="topcv-dots">
            <span className="topcv-dot" />
            <span className="topcv-dot active" />
            <span className="topcv-dot" />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 18 }}>
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
        {catsQuery.isPending && <div className="hint" style={{ margin: "8px 0" }}>Đang tải danh mục…</div>}

        <div className="topcv-hint">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ background: "#00b14f", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>Gợi ý:</span>
            Lọc theo lương, kỹ năng, loại hình, kinh nghiệm — kết quả được cache 5 phút (React Query)
          </span>
          <button className="topcv-hint-close" onClick={(e) => ((e.target as HTMLElement).parentElement!.style.display = "none")}>×</button>
        </div>

        {loading && <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton-card" />)}</div>}
        {err && <div className="alert alert-error">{err}</div>}
        {data && !loading && data.items.length === 0 && (
          <div className="empty">
            <h3>Không tìm thấy việc phù hợp</h3>
            <p className="hint">Thử bỏ bộ lọc hoặc tìm từ khóa khác.</p>
            {hasActiveFilters(params) && <button className="btn btn-ghost" onClick={clearFilters}>Xóa bộ lọc</button>}
          </div>
        )}
        {data && !loading && data.items.length > 0 && (
          <>
            <div className="topcv-grid">
              {data.items.map((j, idx) => <JobCard key={j.id} job={j} index={idx} />)}
            </div>
            <div style={{ marginTop: 10 }}>
              <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => update({ page: String(p) })} />
              <div className="hint" style={{ textAlign: "center", marginTop: 6 }}> Trang {data.page + 1}/{data.totalPages} — Tổng {data.total} việc</div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
