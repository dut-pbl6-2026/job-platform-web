import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JobSearchParams, SearchFacets } from "../types/job";
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
 * they are matched through the one display label each spelling maps to.
 */
function facetCount(facets: SearchFacets | undefined, key: "experienceLevel" | "employmentType", value: string) {
  const label = key === "experienceLevel" ? experienceLevelLabel : employmentTypeLabel;
  const want = label(value, "");
  if (!want) return undefined;
  const hits = facets?.[key]?.filter((item) => label(item.value, "") === want) ?? [];
  return hits.length ? hits.reduce((sum, item) => sum + item.count, 0) : undefined;
}

/** VND amounts are typed in millions ("15" = 15,000,000 VND); USD as is. The URL always holds the raw amount. */
function SalaryInput({
  label,
  value,
  currency,
  onCommit,
}: {
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
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
}

function Radio({
  name,
  checked,
  label,
  onSelect,
}: {
  name: string;
  checked: boolean;
  label: string;
  onSelect: () => void;
}) {
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
  const { t } = useTranslation();
  const uid = useId();
  const [skillQ, setSkillQ] = useState("");
  const selectedTypes = splitCsv(params.employmentType);
  const selectedLevels = splitCsv(params.experienceLevel);
  const selectedSkills = splitCsv(params.skills);
  const currency = params.salaryCurrency === "USD" ? "USD" : "VND";
  const bands = currency === "USD" ? SALARY_BANDS_USD : SALARY_BANDS_VND;
  const noSalary = params.minSalary == null && params.maxSalary == null;
  const bandMatch = bands.find((band) => params.minSalary === band.min && params.maxSalary === band.max);

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
        <legend className="jp-filter-title">{t("jobs.filters.salaryGroup")}</legend>
        <div className="jp-filter-currency" role="group" aria-label={t("jobs.filters.currencyGroup")}>
          {(["VND", "USD"] as const).map((c) => (
            <FilterChip
              key={c}
              pressed={currency === c}
              onClick={() =>
                currency !== c &&
                onChange({ currency: c === "VND" ? undefined : c, minSalary: undefined, maxSalary: undefined })
              }
            >
              {c}
            </FilterChip>
          ))}
        </div>
        <Radio
          name={`${uid}-salary`}
          checked={noSalary}
          label={t("jobs.filters.allSalaries")}
          onSelect={() => onChange({ minSalary: undefined, maxSalary: undefined })}
        />
        {bands.map((band) => (
          <Radio
            key={band.labelKey}
            name={`${uid}-salary`}
            checked={bandMatch === band}
            label={t(band.labelKey)}
            onSelect={() =>
              onChange({ minSalary: String(band.min), maxSalary: band.max != null ? String(band.max) : undefined })
            }
          />
        ))}
        <div className="jp-filter-salary">
          <SalaryInput
            label={currency === "VND" ? t("jobs.filters.fromMillion") : t("jobs.filters.fromUsd")}
            value={params.minSalary}
            currency={currency}
            onCommit={(raw) => onChange({ minSalary: raw })}
          />
          <SalaryInput
            label={currency === "VND" ? t("jobs.filters.toMillion") : t("jobs.filters.toUsd")}
            value={params.maxSalary}
            currency={currency}
            onCommit={(raw) => onChange({ maxSalary: raw })}
          />
        </div>
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">{t("jobs.filters.levelGroup")}</legend>
        {EXPERIENCE_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            label={experienceLevelLabel(value)}
            count={facetCount(facets, "experienceLevel", value)}
            checked={selectedLevels.includes(value)}
            onChange={() => onChange({ experienceLevel: toggleCsv(params.experienceLevel, value) || undefined })}
          />
        ))}
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">{t("jobs.filters.typeGroup")}</legend>
        {EMPLOYMENT_OPTIONS.map((value) => (
          <Checkbox
            key={value}
            label={employmentTypeLabel(value)}
            count={facetCount(facets, "employmentType", value)}
            checked={selectedTypes.includes(value)}
            onChange={() => onChange({ employmentType: toggleCsv(params.employmentType, value) || undefined })}
          />
        ))}
      </fieldset>

      <fieldset className="jp-filter-group">
        <legend className="jp-filter-title">{t("jobs.filters.skillsGroup")}</legend>
        <label className="jp-sr" htmlFor={`${uid}-skill`}>
          {t("jobs.filters.addSkill")}
        </label>
        <div className="jp-filter-skill">
          <input
            id={`${uid}-skill`}
            className="jp-input"
            placeholder={t("jobs.filters.skillPlaceholder")}
            value={skillQ}
            onChange={(e) => setSkillQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              addSkill(skillQ);
            }}
          />
          <button
            type="button"
            className="jp-filter-skill-add"
            aria-label={t("jobs.filters.addSkill")}
            disabled={!skillQ.trim()}
            onClick={() => addSkill(skillQ)}
          >
            <Icon name="plus" />
          </button>
        </div>
        {selectedSkills.length > 0 && (
          <div className="jp-filter-chips">
            {selectedSkills.map((skill) => (
              <RemovableChip
                key={skill}
                label={skill}
                onRemove={() => onChange({ skills: toggleCsv(params.skills, skill) || undefined })}
              />
            ))}
          </div>
        )}
        {selectedSkills.length > 1 && (
          <Checkbox
            label={t("jobs.filters.matchAllSkills")}
            checked={params.skillOp === "and"}
            onChange={(e) => onChange({ skillOp: e.target.checked ? "and" : undefined })}
          />
        )}
      </fieldset>
    </div>
  );
}
