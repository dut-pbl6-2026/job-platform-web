import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  cx,
} from "../components/ui";
import {
  EMPLOYMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  SORT_OPTIONS,
  hasActiveFilters,
  parseSearchParams,
  splitCsv,
  toggleCsv,
} from "../lib/searchFilters";
import { queryKeys } from "../lib/queryClient";
import { categoryLabel, employmentTypeLabel, experienceLevelLabel } from "../lib/labels";
import { loadErrorMessage } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { RecommendedJobs } from "../components/RecommendedJobs";

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
  const { t } = useTranslation();
  useDocumentTitle(t("jobs.title"));
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
  const err = jobsQuery.isError ? loadErrorMessage(jobsQuery.error, t("jobs.listWhat")) : null;
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
    chips.push({
      key: "cat",
      label: name ? categoryLabel(name) : t("jobs.chip.category"),
      clear: { category: undefined },
    });
  }
  if (params.location) chips.push({ key: "loc", label: params.location, clear: { location: undefined } });
  if (params.minSalary != null || params.maxSalary != null) {
    chips.push({
      key: "sal",
      label: formatSalary(params.minSalary ?? 0, params.maxSalary ?? 0, params.salaryCurrency),
      clear: { minSalary: undefined, maxSalary: undefined },
    });
  }
  splitCsv(params.experienceLevel).forEach((v) => {
    chips.push({
      key: `l-${v}`,
      label: (EXPERIENCE_OPTIONS as readonly string[]).includes(v)
        ? experienceLevelLabel(v)
        : t("jobs.chip.experience"),
      clear: { experienceLevel: toggleCsv(params.experienceLevel, v) || undefined },
    });
  });
  splitCsv(params.employmentType).forEach((v) => {
    chips.push({
      key: `t-${v}`,
      label: (EMPLOYMENT_OPTIONS as readonly string[]).includes(v) ? employmentTypeLabel(v) : t("jobs.chip.employment"),
      clear: { employmentType: toggleCsv(params.employmentType, v) || undefined },
    });
  });
  splitCsv(params.skills).forEach((v) => {
    chips.push({ key: `s-${v}`, label: v, clear: { skills: toggleCsv(params.skills, v) || undefined } });
  });
  // The drawer button counts what lives in the drawer (category and place have their own rows).
  const drawerCount = chips.filter((c) => c.key !== "cat" && c.key !== "loc").length;

  const total = data?.total ?? 0;
  const filtered = hasActiveFilters(params);

  return (
    <>
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
          <aside className="jp-jobs-filters" aria-label={t("jobs.drawerTitle")}>
            <AdvancedFilters params={params} facets={data?.facets} onChange={update} />
          </aside>

          <section className="jp-jobs-main" ref={boardRef} aria-labelledby="jp-board-title">
            <div className="jp-boardhead">
              <div className="jp-boardhead-title">
                <h1 id="jp-board-title" className="jp-h1">
                  {t("jobs.boardTitle")}
                </h1>
                <p className="jp-boardhead-count" aria-live="polite">
                  {data ? t("jobs.countLabel", { total: total.toLocaleString("vi-VN") }) : " "}
                  {data && params.q && (
                    <>
                      {" "}
                      {t("jobs.forQueryBefore")}
                      <strong>{params.q}</strong>
                      {t("jobs.forQueryAfter")}
                    </>
                  )}
                </p>
              </div>
              <div className="jp-boardhead-tools">
                <Button
                  variant="secondary"
                  icon="filter"
                  className="jp-filters-open"
                  aria-haspopup="dialog"
                  onClick={() => setDrawerOpen(true)}
                >
                  {t("jobs.filtersButton")}
                  {drawerCount ? ` (${drawerCount})` : ""}
                </Button>
                <label className="jp-sort">
                  <span>{t("jobs.sortLabel")}</span>
                  <Select
                    value={params.sortBy || "relevance"}
                    onChange={(e) => update({ sort: e.target.value === "relevance" ? undefined : e.target.value })}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {t(o.labelKey)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>

            {chips.length > 0 && (
              <div className="jp-active-filters" role="group" aria-label={t("jobs.activeFiltersLabel")}>
                {chips.map((chip) => (
                  <RemovableChip key={chip.key} label={chip.label} onRemove={() => update(chip.clear)} />
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t("jobs.clearFilters")}
                </Button>
              </div>
            )}

            {err && (
              <Alert
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={jobsQuery.isFetching}
                    onClick={() => void jobsQuery.refetch()}
                  >
                    {jobsQuery.isFetching ? t("jobs.retrying") : t("jobs.retry")}
                  </Button>
                }
              >
                {err}
              </Alert>
            )}

            {jobsQuery.isPending && (
              <div className="jp-board">
                <SkeletonRows rows={8} label={t("jobs.loadingBoard")} />
              </div>
            )}

            {data && !err && items.length === 0 && (
              <div className="jp-board">
                {filtered ? (
                  <EmptyState
                    title={t("jobs.emptyFilteredTitle")}
                    action={
                      <Button variant="secondary" onClick={clearFilters}>
                        {t("jobs.clearFilters")}
                      </Button>
                    }
                  >
                    {t("jobs.emptyFilteredText")}
                  </EmptyState>
                ) : params.q ? (
                  <EmptyState
                    title={t("jobs.emptyQueryTitle", { q: params.q })}
                    action={
                      <Button variant="secondary" onClick={() => update({ q: undefined })}>
                        {t("jobs.clearQuery")}
                      </Button>
                    }
                  >
                    {t("jobs.emptyQueryText")}
                  </EmptyState>
                ) : (
                  <EmptyState title={t("jobs.emptyNoneTitle")}>{t("jobs.emptyNoneText")}</EmptyState>
                )}
              </div>
            )}

            <RecommendedJobs />

            {data && !err && items.length > 0 && (
              <div
                className={cx("jp-board-wrap", jobsQuery.isPlaceholderData && "is-stale")}
                aria-busy={jobsQuery.isPlaceholderData || undefined}
              >
                <Board
                  sort={params.sortBy}
                  onSalarySort={(next) => update({ sort: next })}
                  label={t("jobs.boardLabel", { page: data.page + 1 })}
                >
                  {items.map((job) => (
                    <JobRow key={job.id} job={job} selected={job.id === lastJobId} onOpen={(j) => remember(j.id)} />
                  ))}
                </Board>
                <div className="jp-board-foot">
                  <Pagination
                    page={data.page}
                    totalPages={data.totalPages}
                    onPage={goToPage}
                    label={t("jobs.paginationLabel")}
                  />
                  {data.totalPages > 1 && (
                    <p className="jp-board-pageinfo">
                      {t("jobs.pageInfo", { page: data.page + 1, total: data.totalPages })}
                    </p>
                  )}
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
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawerOpen(false);
        }}
      >
        {drawerOpen && (
          <div className="jp-drawer-inner">
            <div className="jp-drawer-head">
              <h2 id="jp-drawer-title" className="jp-h2">
                {t("jobs.drawerTitle")}
              </h2>
              <button
                type="button"
                className="jp-drawer-close"
                aria-label={t("jobs.closeFilters")}
                onClick={() => setDrawerOpen(false)}
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="jp-drawer-body">
              <AdvancedFilters params={params} facets={data?.facets} onChange={update} />
            </div>
            <div className="jp-drawer-foot">
              <Button variant="secondary" disabled={!filtered} onClick={clearFilters}>
                {t("jobs.clearFilters")}
              </Button>
              <Button onClick={() => setDrawerOpen(false)}>
                {data ? t("jobs.viewResults", { total: total.toLocaleString("vi-VN") }) : t("jobs.viewResultsDefault")}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
