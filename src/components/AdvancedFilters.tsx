import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { JobSearchParams, SearchFacets } from "../types/job";
import { fetchSkills } from "../lib/jobsApi";
import { queryKeys } from "../lib/queryClient";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  EMPLOYMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  SALARY_BANDS_USD,
  SALARY_BANDS_VND,
  splitCsv,
  toggleCsv,
} from "../lib/searchFilters";
import { employmentTypeLabel, experienceLevelLabel } from "../lib/labels";
import { Checkbox, FilterChip, Icon, RemovableChip } from "./ui";

type Props = {
  params: JobSearchParams;
  facets?: SearchFacets;
  onChange: (patch: Record<string, string | undefined>) => void;
};

/**
 * Buckets arrive in whatever spelling the source uses ("Mid", "Middle", "Full-time", "FullTime"), so
 * they are matched through the one Vietnamese label each spelling maps to.
 */
function facetCount(facets: SearchFacets | undefined, key: "experienceLevel" | "employmentType", value: string) {
  const label = key === "experienceLevel" ? experienceLevelLabel : employmentTypeLabel;
  const want = label(value, "");
  if (!want) return undefined;
  const hits = facets?.[key]?.filter((item) => label(item.value, "") === want) ?? [];
  return hits.length ? hits.reduce((sum, item) => sum + item.count, 0) : undefined;
}

/** VND amounts are typed in millions ("15" = 15.000.000 đ); USD as is. The URL always holds the raw amount. */
function SalaryInput({ label, value, currency, onCommit }: {
  label: string;
  value?: number;
  currency: "VND" | "USD";
  onCommit: (raw: string | undefined) => void;
}) {
  const id = useId();
  const scale = currency === "VND" ? 1_000_000 : 1;
  const current = value != null ? String(value / scale) : "";
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  const commit = () => {
    const typed = draft.trim().replace(",", ".");
    if (typed === current) return;
    const n = Number(typed);
    if (!typed) onCommit(undefined);
    else if (Number.isFinite(n) && n >= 0) onCommit(String(Math.round(n * scale)));
    else setDraft(current);
  };
  return (
    <div className="jp-filter-salary-input">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="jp-input"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
      />
    </div>
  );
}

function Radio({ name, checked, label, onSelect }: { name: string; checked: boolean; label: string; onSelect: () => void }) {
  return (
    <label className="jp-check jp-radio">
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span className="jp-check-box" aria-hidden="true" />
      <span className="jp-check-label">{label}</span>
    </label>
  );
}

/**
 * Filter groups for the board: salary, level, type, skills. Category and place have their own rows
 * above the board. Every change goes straight to the URL (`onChange`), the single source of truth.
 */
export function AdvancedFilters({ params, facets, onChange }: Props) {
  const uid = useId();
  const [skillQ, setSkillQ] = useState("");
  const debouncedSkillQ = useDebouncedValue(skillQ.trim(), 250);
  const selectedTypes = splitCsv(params.employmentType);
  const selectedLevels = splitCsv(params.experienceLevel);
  const selectedSkills = splitCsv(params.skills);
  const currency = params.salaryCurrency === "USD" ? "USD" : "VND";
  const bands = currency === "USD" ? SALARY_BANDS_USD : SALARY_BANDS_VND;
  const noSalary = params.minSalary == null && params.maxSalary == null;
  const bandMatch = bands.find((band) => params.minSalary === band.min && params.maxSalary === band.max);

  const skillsQuery = useQuery({
    queryKey: queryKeys.skills(debouncedSkillQ),
    queryFn: () => fetchSkills(debouncedSkillQ),
  });
  const suggestions = (skillsQuery.data ?? []).filter((s) => !selectedSkills.includes(s.name)).slice(0, 8);

  function addSkill(name: string) {
    const typed = name.trim();
    if (typed && !selectedSkills.some((s) => s.toLowerCase() === typed.toLowerCase())) {
      onChange({ skills: toggleCsv(params.skills, typed) || undefined });
    }
    setSkillQ("");
  }

  return (
    <div className="jp-filters">
      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">Mức lương</legend>
        <div className="jp-filter-currency" role="group" aria-label="Đơn vị tiền">
          {(["VND", "USD"] as const).map((c) => (
            <FilterChip
              key={c}
              pressed={currency === c}
              onClick={() => currency !== c && onChange({ currency: c === "VND" ? undefined : c, minSalary: undefined, maxSalary: undefined })}
            >
              {c}
            </FilterChip>
          ))}
        </div>
        <Radio name={`${uid}-salary`} checked={noSalary} label="Tất cả mức lương" onSelect={() => onChange({ minSalary: undefined, maxSalary: undefined })} />
        {bands.map((band) => (
          <Radio
            key={band.label}
            name={`${uid}-salary`}
            checked={bandMatch === band}
            label={band.label}
            onSelect={() => onChange({ minSalary: String(band.min), maxSalary: band.max != null ? String(band.max) : undefined })}
          />
        ))}
        <div className="jp-filter-salary">
          <SalaryInput label={currency === "VND" ? "Từ (triệu)" : "Từ (USD)"} value={params.minSalary} currency={currency} onCommit={(raw) => onChange({ minSalary: raw })} />
          <SalaryInput label={currency === "VND" ? "Đến (triệu)" : "Đến (USD)"} value={params.maxSalary} currency={currency} onCommit={(raw) => onChange({ maxSalary: raw })} />
        </div>
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">Cấp bậc</legend>
        {EXPERIENCE_OPTIONS.map((item) => (
          <Checkbox
            key={item.value}
            label={item.label}
            count={facetCount(facets, "experienceLevel", item.value)}
            checked={selectedLevels.includes(item.value)}
            onChange={() => onChange({ experienceLevel: toggleCsv(params.experienceLevel, item.value) || undefined })}
          />
        ))}
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">Hình thức</legend>
        {EMPLOYMENT_OPTIONS.map((item) => (
          <Checkbox
            key={item.value}
            label={item.label}
            count={facetCount(facets, "employmentType", item.value)}
            checked={selectedTypes.includes(item.value)}
            onChange={() => onChange({ employmentType: toggleCsv(params.employmentType, item.value) || undefined })}
          />
        ))}
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">Kỹ năng</legend>
        <label className="jp-sr" htmlFor={`${uid}-skill`}>Thêm kỹ năng</label>
        <div className="jp-filter-skill">
          <input
            id={`${uid}-skill`}
            className="jp-input"
            placeholder="Gõ kỹ năng rồi Enter"
            value={skillQ}
            onChange={(e) => setSkillQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addSkill(skillQ);
            }}
          />
          <button type="button" className="jp-filter-skill-add" aria-label="Thêm kỹ năng" disabled={!skillQ.trim()} onClick={() => addSkill(skillQ)}>
            <Icon name="plus" />
          </button>
        </div>
        {selectedSkills.length > 0 && (
          <div className="jp-filter-chips">
            {selectedSkills.map((skill) => (
              <RemovableChip key={skill} label={skill} onRemove={() => onChange({ skills: toggleCsv(params.skills, skill) || undefined })} />
            ))}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="jp-filter-chips" aria-label="Gợi ý kỹ năng">
            {suggestions.map((skill) => (
              <FilterChip key={skill.id} pressed={false} onClick={() => addSkill(skill.name)}>{skill.name}</FilterChip>
            ))}
          </div>
        )}
        {selectedSkills.length > 1 && (
          <Checkbox
            label="Có đủ tất cả kỹ năng đã chọn"
            checked={params.skillOp === "and"}
            onChange={(e) => onChange({ skillOp: e.target.checked ? "and" : undefined })}
          />
        )}
      </fieldset>
    </div>
  );
}
