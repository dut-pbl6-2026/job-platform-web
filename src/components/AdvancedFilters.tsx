import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { JobSearchParams, SearchFacets } from "../types/job";
import { fetchSkills } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import {
  EMPLOYMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  SALARY_BANDS_USD,
  SALARY_BANDS_VND,
  SORT_OPTIONS,
  LOCATION_PILLS,
  hasActiveFilters,
  splitCsv,
  toggleCsv,
} from "../lib/searchFilters";

type Props = {
  params: JobSearchParams;
  facets?: SearchFacets;
  categories: string[];
  onChange: (patch: Record<string, string | undefined>) => void;
  onClear: () => void;
};

function facetCount(facets: SearchFacets | undefined, key: keyof SearchFacets, value: string) {
  const hit = facets?.[key]?.find((item) => item.value.toLowerCase() === value.toLowerCase());
  return hit?.count;
}

export function AdvancedFilters({ params, facets, categories, onChange, onClear }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [skillQ, setSkillQ] = useState("");
  const selectedTypes = splitCsv(params.employmentType);
  const selectedLevels = splitCsv(params.experienceLevel);
  const selectedSkills = splitCsv(params.skills);
  const currency = params.salaryCurrency === "USD" ? "USD" : "VND";
  const bands = currency === "USD" ? SALARY_BANDS_USD : SALARY_BANDS_VND;

  const skillsQuery = useQuery({
    queryKey: queryKeys.skills(skillQ),
    queryFn: () => fetchSkills(skillQ),
    enabled: open === "skills",
  });

  const chips = useMemo(() => {
    const items: { key: string; label: string; clear: Record<string, string | undefined> }[] = [];
    if (params.location) items.push({ key: "loc", label: params.location, clear: { location: undefined } });
    if (params.category) items.push({ key: "cat", label: params.category, clear: { category: undefined } });
    selectedTypes.forEach((value) => {
      const label = EMPLOYMENT_OPTIONS.find((item) => item.value === value)?.label || value;
      items.push({ key: `t-${value}`, label, clear: { employmentType: toggleCsv(params.employmentType, value) || undefined } });
    });
    selectedLevels.forEach((value) => {
      const label = EXPERIENCE_OPTIONS.find((item) => item.value === value)?.label || value;
      items.push({ key: `l-${value}`, label, clear: { experienceLevel: toggleCsv(params.experienceLevel, value) || undefined } });
    });
    selectedSkills.forEach((value) => {
      items.push({ key: `s-${value}`, label: value, clear: { skills: toggleCsv(params.skills, value) || undefined } });
    });
    if (params.minSalary != null || params.maxSalary != null) {
      const min = params.minSalary != null ? params.minSalary.toLocaleString("vi-VN") : "0";
      const max = params.maxSalary != null ? params.maxSalary.toLocaleString("vi-VN") : "+";
      items.push({ key: "sal", label: `${min}–${max} ${currency}`, clear: { minSalary: undefined, maxSalary: undefined } });
    }
    if (params.sortBy && params.sortBy !== "relevance") {
      const label = SORT_OPTIONS.find((item) => item.value === params.sortBy)?.label || params.sortBy;
      items.push({ key: "sort", label, clear: { sort: undefined } });
    }
    return items;
  }, [params, selectedTypes, selectedLevels, selectedSkills, currency]);

  return (
    <div className="adv-wrap">
      <div className="topcv-filter-bar">
        <span className="topcv-filter-label">Lọc theo:</span>
        <span className="topcv-filter-select">Địa điểm <span>▾</span></span>
        <button type="button" className="topcv-circle-btn" aria-label="Cuộn trái">‹</button>
        <div className="topcv-pills">
          {LOCATION_PILLS.map((lp) => {
            const isActive = (!params.location && !lp.value) || params.location === lp.value;
            return (
              <button
                key={lp.label}
                type="button"
                className={`topcv-pill ${isActive ? "active" : ""}`}
                onClick={() => onChange({ location: lp.value || undefined })}
              >
                {lp.label}
              </button>
            );
          })}
        </div>
        <button type="button" className="topcv-circle-btn" aria-label="Cuộn phải">›</button>
      </div>

      <div className="adv-toolbar">
        {[
          { id: "salary", label: "Mức lương" },
          { id: "type", label: "Loại hình" },
          { id: "level", label: "Kinh nghiệm" },
          { id: "skills", label: "Kỹ năng" },
          { id: "category", label: "Danh mục" },
          { id: "sort", label: "Sắp xếp" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`adv-toggle ${open === item.id ? "active" : ""}`}
            onClick={() => setOpen((cur) => (cur === item.id ? null : item.id))}
            aria-expanded={open === item.id}
          >
            {item.label} ▾
          </button>
        ))}
        {hasActiveFilters(params) && (
          <button type="button" className="adv-clear" onClick={() => { onClear(); setOpen(null); }}>Xóa bộ lọc</button>
        )}
      </div>

      {open === "salary" && (
        <div className="adv-panel">
          <div className="adv-currency">
            <button type="button" className={currency === "VND" ? "active" : ""} onClick={() => onChange({ currency: "VND", minSalary: undefined, maxSalary: undefined })}>VND</button>
            <button type="button" className={currency === "USD" ? "active" : ""} onClick={() => onChange({ currency: "USD", minSalary: undefined, maxSalary: undefined })}>USD</button>
          </div>
          <div className="adv-options">
            {bands.map((band) => {
              const active = params.minSalary === band.min && params.maxSalary === band.max;
              return (
                <button
                  key={band.label}
                  type="button"
                  className={`topcv-pill ${active ? "active" : ""}`}
                  onClick={() => onChange({
                    minSalary: String(band.min),
                    maxSalary: band.max != null ? String(band.max) : undefined,
                    currency,
                  })}
                >
                  {band.label}
                </button>
              );
            })}
          </div>
          <div className="adv-salary-inputs">
            <label>
              Tối thiểu
              <input type="number" min={0} value={params.minSalary ?? ""} onChange={(e) => onChange({ minSalary: e.target.value, currency })} />
            </label>
            <label>
              Tối đa
              <input type="number" min={0} value={params.maxSalary ?? ""} onChange={(e) => onChange({ maxSalary: e.target.value, currency })} />
            </label>
          </div>
        </div>
      )}

      {open === "type" && (
        <div className="adv-panel">
          <button type="button" className={`topcv-pill ${selectedTypes.length === 0 ? "active" : ""}`} onClick={() => onChange({ employmentType: undefined })}>Bất kỳ</button>
          <div className="adv-options">
            {EMPLOYMENT_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`topcv-pill ${selectedTypes.includes(item.value) ? "active" : ""}`}
                onClick={() => onChange({ employmentType: toggleCsv(params.employmentType, item.value) || undefined })}
              >
                {item.label}
                {facetCount(facets, "employmentType", item.value) != null ? ` (${facetCount(facets, "employmentType", item.value)})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "level" && (
        <div className="adv-panel">
          <button type="button" className={`topcv-pill ${selectedLevels.length === 0 ? "active" : ""}`} onClick={() => onChange({ experienceLevel: undefined })}>Bất kỳ</button>
          <div className="adv-options">
            {EXPERIENCE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`topcv-pill ${selectedLevels.includes(item.value) ? "active" : ""}`}
                onClick={() => onChange({ experienceLevel: toggleCsv(params.experienceLevel, item.value) || undefined })}
              >
                {item.label}
                {facetCount(facets, "experienceLevel", item.value) != null ? ` (${facetCount(facets, "experienceLevel", item.value)})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "skills" && (
        <div className="adv-panel">
          <div className="adv-skill-row">
            <input
              className="input"
              placeholder="Gõ kỹ năng (React, Python…)"
              value={skillQ}
              onChange={(e) => setSkillQ(e.target.value)}
              aria-label="Tìm kỹ năng"
            />
            <label className="adv-op">
              <input
                type="checkbox"
                checked={params.skillOp === "or"}
                onChange={(e) => onChange({ skillOp: e.target.checked ? "or" : "and" })}
              />
              Khớp bất kỳ (OR)
            </label>
          </div>
          <div className="adv-options">
            {(skillsQuery.data ?? []).map((skill) => (
              <button
                key={skill.id}
                type="button"
                className={`topcv-pill ${selectedSkills.includes(skill.name) ? "active" : ""}`}
                onClick={() => { onChange({ skills: toggleCsv(params.skills, skill.name) || undefined }); setSkillQ(""); }}
              >
                {skill.name}{skill.count ? ` (${skill.count})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "category" && (
        <div className="adv-panel">
          <div className="adv-options">
            {categories.filter(Boolean).map((name) => (
              <button
                key={name}
                type="button"
                className={`topcv-pill ${params.category === name ? "active" : ""}`}
                onClick={() => onChange({ category: params.category === name ? undefined : name })}
              >
                {name}
                {facetCount(facets, "category", name) != null ? ` (${facetCount(facets, "category", name)})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {open === "sort" && (
        <div className="adv-panel">
          <div className="adv-options">
            {SORT_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`topcv-pill ${(params.sortBy || "relevance") === item.value ? "active" : ""}`}
                onClick={() => onChange({ sort: item.value === "relevance" ? undefined : item.value })}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="adv-chips">
          {chips.map((chip) => (
            <button key={chip.key} type="button" className="adv-chip" onClick={() => onChange(chip.clear)}>
              {chip.label} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
