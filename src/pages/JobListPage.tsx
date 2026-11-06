import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCategories, fetchJobs, formatSalary } from "../lib/jobsApi";
import { SearchBar } from "../components/SearchBar";
import { CategoryRow } from "../components/CategoryRow";
import { AdvancedFilters } from "../components/AdvancedFilters";
import {
  Alert,
  Board,
  Button,
  EmptyState,
  Icon,
  JobRow,
  Pagination,
  RemovableChip,
  Select,
  SkeletonRows,
  TopBar,
  cx,
} from "../components/ui";
import { EMPLOYMENT_OPTIONS, EXPERIENCE_OPTIONS, SORT_OPTIONS, hasActiveFilters, parseSearchParams, splitCsv, toggleCsv } from "../lib/searchFilters";
import { queryKeys } from "../lib/queryClient";
import { categoryLabel } from "../lib/labels";
import { loadErrorMessage } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

// The row the visitor opened last gets the amber "your selection" band when they come back.
const LAST_JOB_KEY = "jp.lastJob";

function readLastJob(): string | null {
  try {
    return sessionStorage.getItem(LAST_JOB_KEY);
  } catch {
    return null;
  }
}

type Patch = Record<string, string | undefined>;

export default function JobListPage() {
  useDocumentTitle("Việc làm");
  const [sp, setSp] = useSearchParams();
  const params = parseSearchParams(sp);
  const [lastJobId, setLastJobId] = useState(readLastJob);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const boardRef = useRef<HTMLElement>(null);

  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs(params),
    queryFn: () => fetchJobs(params),
    // Keep the current rows on screen while the next filter or page loads, instead of a blank board.
    placeholderData: (previous) => previous,
  });
  const catsQuery = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories });

  const data = jobsQuery.data;
  const items = data?.items ?? [];
  const err = jobsQuery.isError ? loadErrorMessage(jobsQuery.error, "danh sách việc làm") : null;
  const categories = (catsQuery.data ?? []).filter((c) => c.id && c.name);

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
  }, [drawerOpen]);

  function update(next: Patch) {
    const n = new URLSearchParams(sp);
    Object.entries(next).forEach(([k, v]) => {
      if (v == null || v === "") n.delete(k);
      else n.set(k, v);
    });
    if (!("page" in next)) n.delete("page");
    if (n.get("page") === "0") n.delete("page");
    setSp(n, { replace: false });
  }

  function goToPage(page: number) {
    update({ page: String(page) });
    boardRef.current?.scrollIntoView({ block: "start" });
  }

  function clearFilters() {
    setSp(params.q ? { q: params.q } : {}, { replace: false });
  }

  function remember(id: string) {
    setLastJobId(id);
    try {
      sessionStorage.setItem(LAST_JOB_KEY, id);
    } catch {
      /* storage blocked: the band is a nicety */
    }
  }

  // One removable chip per active filter, in the order the filters appear on screen.
  const chips: { key: string; label: string; clear: Patch }[] = [];
  if (params.category) {
    const name = categories.find((c) => c.id === params.category)?.name;
    chips.push({ key: "cat", label: name ? categoryLabel(name) : "Ngành nghề đã chọn", clear: { category: undefined } });
  }
  if (params.location) chips.push({ key: "loc", label: params.location, clear: { location: undefined } });
  if (params.minSalary != null || params.maxSalary != null) {
    chips.push({
      key: "sal",
      label: formatSalary(params.minSalary ?? 0, params.maxSalary ?? 0, params.salaryCurrency),
      clear: { minSalary: undefined, maxSalary: undefined },
    });
  }
  splitCsv(params.experienceLevel).forEach((v) => chips.push({
    key: `l-${v}`,
    label: EXPERIENCE_OPTIONS.find((o) => o.value === v)?.label ?? "Cấp bậc đã chọn",
    clear: { experienceLevel: toggleCsv(params.experienceLevel, v) || undefined },
  }));
  splitCsv(params.employmentType).forEach((v) => chips.push({
    key: `t-${v}`,
    label: EMPLOYMENT_OPTIONS.find((o) => o.value === v)?.label ?? "Hình thức đã chọn",
    clear: { employmentType: toggleCsv(params.employmentType, v) || undefined },
  }));
  splitCsv(params.skills).forEach((v) => chips.push({ key: `s-${v}`, label: v, clear: { skills: toggleCsv(params.skills, v) || undefined } }));
  // The drawer button counts what lives in the drawer (category and place have their own rows).
  const drawerCount = chips.filter((c) => c.key !== "cat" && c.key !== "loc").length;

  const total = data?.total ?? 0;
  const filtered = hasActiveFilters(params);

  return (
    <>
      <TopBar />
      <div className="jp-searchband">
        <div className="jp-searchband-inner">
          <SearchBar
            initialQ={params.q || ""}
            initialLoc={params.location || ""}
            onSearch={(q, loc) => update({ q: q || undefined, location: loc || undefined })}
          />
        </div>
      </div>

      <main className="jp-page jp-jobs">
        <CategoryRow
          categories={categories}
          selectedId={params.category}
          facets={data?.facets}
          loadFailed={catsQuery.isError}
          retrying={catsQuery.isFetching}
          onRetry={() => void catsQuery.refetch()}
          onSelect={(id) => update({ category: id })}
        />

        <div className="jp-jobs-grid">
          <aside className="jp-jobs-filters" aria-label="Bộ lọc">
            <AdvancedFilters params={params} facets={data?.facets} onChange={update} />
          </aside>

          <section className="jp-jobs-main" ref={boardRef} aria-labelledby="jp-board-title">
            <div className="jp-boardhead">
              <div className="jp-boardhead-title">
                <h1 id="jp-board-title" className="jp-h1">Bảng việc làm</h1>
                <p className="jp-boardhead-count" aria-live="polite">
                  {data ? `${total.toLocaleString("vi-VN")} việc đang tuyển` : " "}
                  {data && params.q && <> cho “<strong>{params.q}</strong>”</>}
                </p>
              </div>
              <div className="jp-boardhead-tools">
                <Button variant="secondary" icon="filter" className="jp-filters-open" aria-haspopup="dialog" onClick={() => setDrawerOpen(true)}>
                  Bộ lọc{drawerCount ? ` (${drawerCount})` : ""}
                </Button>
                <label className="jp-sort">
                  <span>Sắp xếp</span>
                  <Select value={params.sortBy || "relevance"} onChange={(e) => update({ sort: e.target.value === "relevance" ? undefined : e.target.value })}>
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </label>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="jp-active-filters" aria-label="Bộ lọc đang bật">
                {chips.map((chip) => <RemovableChip key={chip.key} label={chip.label} onRemove={() => update(chip.clear)} />)}
                <Button variant="ghost" size="sm" onClick={clearFilters}>Xóa bộ lọc</Button>
              </div>
            )}

            {err && (
              <Alert
                action={
                  <Button variant="secondary" size="sm" loading={jobsQuery.isFetching} onClick={() => void jobsQuery.refetch()}>
                    {jobsQuery.isFetching ? "Đang thử lại…" : "Thử lại"}
                  </Button>
                }
              >
                {err}
              </Alert>
            )}

            {jobsQuery.isPending && (
              <div className="jp-board">
                <SkeletonRows rows={8} label="Đang tải bảng việc làm" />
              </div>
            )}

            {data && !err && items.length === 0 && (
              <div className="jp-board">
                {filtered ? (
                  <EmptyState title="Không có việc khớp bộ lọc" action={<Button variant="secondary" onClick={clearFilters}>Xóa bộ lọc</Button>}>
                    Bỏ bớt bộ lọc đang bật ở trên, hoặc xóa hết để xem cả bảng.
                  </EmptyState>
                ) : params.q ? (
                  <EmptyState title={`Không có việc nào khớp “${params.q}”`} action={<Button variant="secondary" onClick={() => update({ q: undefined })}>Xóa từ khóa</Button>}>
                    Thử từ khóa ngắn hơn, hoặc tên kỹ năng thay vì tên vị trí.
                  </EmptyState>
                ) : (
                  <EmptyState title="Chưa có việc làm nào đang tuyển">Khi có tin mới được duyệt, bảng sẽ hiện ở đây.</EmptyState>
                )}
              </div>
            )}

            {data && !err && items.length > 0 && (
              <div className={cx("jp-board-wrap", jobsQuery.isPlaceholderData && "is-stale")} aria-busy={jobsQuery.isPlaceholderData || undefined}>
                <Board
                  sort={params.sortBy}
                  onSalarySort={(next) => update({ sort: next })}
                  label={`Trang ${data.page + 1} của bảng việc làm`}
                >
                  {items.map((job) => (
                    <JobRow key={job.id} job={job} selected={job.id === lastJobId} onOpen={(j) => remember(j.id)} />
                  ))}
                </Board>
                <div className="jp-board-foot">
                  <Pagination page={data.page} totalPages={data.totalPages} onPage={goToPage} label="Trang của bảng việc làm" />
                  {data.totalPages > 1 && <p className="jp-board-pageinfo">Trang {data.page + 1} / {data.totalPages}</p>}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <dialog
        ref={drawerRef}
        className="jp-drawer"
        aria-labelledby="jp-drawer-title"
        onClose={() => setDrawerOpen(false)}
        onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
      >
        {drawerOpen && (
          <div className="jp-drawer-inner">
            <div className="jp-drawer-head">
              <h2 id="jp-drawer-title" className="jp-h2">Bộ lọc</h2>
              <button type="button" className="jp-drawer-close" aria-label="Đóng bộ lọc" onClick={() => setDrawerOpen(false)}>
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="jp-drawer-body">
              <AdvancedFilters params={params} facets={data?.facets} onChange={update} />
            </div>
            <div className="jp-drawer-foot">
              <Button variant="secondary" disabled={!filtered} onClick={clearFilters}>Xóa bộ lọc</Button>
              <Button onClick={() => setDrawerOpen(false)}>
                {data ? `Xem ${total.toLocaleString("vi-VN")} việc` : "Xem kết quả"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
