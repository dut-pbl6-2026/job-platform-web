import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Field, Icon, Input, Select, Textarea } from "./ui";
import { CompanyPicker } from "./CompanyPicker";
import i18n from "../i18n";
import { fetchCategories, type CompanyOption } from "../lib/jobsApi";
import { validationErrors, type AdminJobInput } from "../lib/adminApi";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { categoryLabel, employmentTypeLabel, experienceLevelLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { PendingJob } from "../types/admin";

/** job-svc values (JobCreateDto). normalizeJob turns them into display spellings, so map back on edit. */
const EMPLOYMENT_TYPES = ["FullTime", "PartTime", "Contract", "Internship"] as const;
const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Lead"] as const;
const CURRENCIES = ["VND", "USD"] as const;

const flat = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[\s_-]+/g, "");
const EMPLOYMENT_BACK: Record<string, string> = {
  fulltime: "FullTime",
  parttime: "PartTime",
  contract: "Contract",
  internship: "Internship",
};
const EXPERIENCE_BACK: Record<string, string> = {
  entry: "Entry",
  junior: "Entry",
  mid: "Mid",
  middle: "Mid",
  senior: "Senior",
  lead: "Lead",
};

type Draft = {
  title: string;
  company: CompanyOption | null;
  location: string;
  categoryId: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  description: string;
  requirements: string;
  benefits: string;
};

type Errors = Partial<Record<"title" | "companyId" | "location" | "categoryId" | "salary" | "description", string>>;

function toDraft(job?: PendingJob | null): Draft {
  return {
    title: job?.title ?? "",
    company: job?.companyId
      ? {
          id: job.companyId,
          name: job.company?.name && job.company.name !== "—" ? job.company.name : i18n.t("admin.form.unnamedCompany"),
        }
      : null,
    location: job?.location ?? "",
    categoryId: job?.categoryId ?? "",
    employmentType: EMPLOYMENT_BACK[flat(job?.employmentType)] ?? "FullTime",
    experienceLevel: EXPERIENCE_BACK[flat(job?.experienceLevel)] ?? "Entry",
    salaryMin: job?.salaryMin ? String(job.salaryMin) : "",
    salaryMax: job?.salaryMax ? String(job.salaryMax) : "",
    salaryCurrency: job?.salaryCurrency || "VND",
    description: job?.description ?? "",
    requirements: job?.requirements ?? "",
    benefits: job?.benefits ?? "",
  };
}

function toNumber(raw: string): number | undefined | null {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Create or edit a job as an admin. The fields are job-svc's JobCreateDto/JobUpdateDto; the company is
 * picked by name (never a UUID on screen). Client checks mirror the backend's required fields, and a
 * ValidationProblem from job-svc lands next to the matching field.
 */
export function AdminJobForm({
  idPrefix,
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial?: PendingJob | null;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: AdminJobInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [errors, setErrors] = useState<Errors>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories, staleTime: Infinity });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const id = (name: string) => `${idPrefix}-${name}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!draft.title.trim()) next.title = t("admin.form.titleRequired");
    if (!draft.company) next.companyId = t("admin.form.companyRequired");
    if (!draft.location.trim()) next.location = t("admin.form.locationRequired");
    if (!draft.description.trim()) next.description = t("admin.form.descriptionRequired");
    const salaryMin = toNumber(draft.salaryMin);
    const salaryMax = toNumber(draft.salaryMax);
    if (salaryMin === null || salaryMax === null) next.salary = t("admin.form.salaryNotNegative");
    else if (salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax) {
      next.salary = t("admin.form.salaryRange");
    }
    setErrors(next);
    setFormErr(null);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await onSubmit({
        title: draft.title.trim(),
        description: draft.description.trim(),
        companyId: draft.company!.id,
        location: draft.location.trim(),
        salaryMin: salaryMin ?? undefined,
        salaryMax: salaryMax ?? undefined,
        salaryCurrency: draft.salaryCurrency,
        categoryId: draft.categoryId || undefined,
        requirements: draft.requirements.trim() || undefined,
        benefits: draft.benefits.trim() || undefined,
        employmentType: draft.employmentType,
        experienceLevel: draft.experienceLevel,
      });
    } catch (err: unknown) {
      const fields = validationErrors(err);
      // job-svc writes validation text in English: mark the field with our own text instead of echoing it.
      const known: Errors = {};
      for (const key of ["title", "companyId", "location", "categoryId", "description"] as const) {
        if (fields[key]) known[key] = i18n.t(SERVER_FIELD_KEY[key]);
      }
      setErrors(known);
      if (Object.keys(known).length) {
        setFormErr(t("admin.form.someInvalid"));
      } else if (fields.request) {
        setFormErr(t("admin.form.requestInvalid"));
      } else if (httpStatus(err) === 409) {
        // PUT on a job deleted meanwhile; job-svc words it in English.
        setFormErr(t("admin.form.deletedEdit"));
      } else if (httpStatus(err) === 404) {
        setFormErr(t("admin.form.notFoundEdit"));
      } else {
        setFormErr(apiErrorMessage(err, t("admin.form.saveFailed")));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="jp-jobform" noValidate onSubmit={submit}>
      {formErr && <Alert tone="error">{formErr}</Alert>}
      <div className="jp-form-grid">
        <Field
          id={id("title")}
          label={t("admin.form.titleLabel")}
          required
          error={errors.title}
          className="jp-field--wide"
        >
          <Input value={draft.title} maxLength={256} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <CompanyPicker
          id={id("company")}
          label={t("admin.form.companyLabel")}
          value={draft.company}
          onChange={(c) => set("company", c)}
          error={errors.companyId}
        />
        <Field id={id("location")} label={t("admin.form.locationLabel")} required error={errors.location}>
          <Input
            value={draft.location}
            maxLength={256}
            placeholder={t("admin.form.locationPlaceholder")}
            onChange={(e) => set("location", e.target.value)}
          />
        </Field>
        <div className="jp-field--wide jp-jobform-trio">
          <Field id={id("category")} label={t("admin.form.categoryLabel")} error={errors.categoryId}>
            <Select value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">{t("labels.unassigned")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryLabel(c.name)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("employment")} label={t("admin.form.employmentLabel")}>
            <Select value={draft.employmentType} onChange={(e) => set("employmentType", e.target.value)}>
              {EMPLOYMENT_TYPES.map((v) => (
                <option key={v} value={v}>
                  {employmentTypeLabel(v)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id={id("experience")} label={t("admin.form.experienceLabel")}>
            <Select value={draft.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)}>
              {EXPERIENCE_LEVELS.map((v) => (
                <option key={v} value={v}>
                  {experienceLevelLabel(v)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <fieldset className="jp-jobform-salary jp-field--wide">
          <legend className="jp-label">
            {t("admin.form.salaryLabel")} <span className="jp-optional">{t("admin.form.salaryHint")}</span>
          </legend>
          {/* One error for the pair, so these two inputs are wired by hand rather than through Field. */}
          <div className="jp-jobform-salary-row">
            {(["salaryMin", "salaryMax"] as const).map((key) => (
              <div key={key} className="jp-field">
                <label className="jp-label" htmlFor={id(key)}>
                  {key === "salaryMin" ? t("admin.form.salaryFrom") : t("admin.form.salaryTo")}
                </label>
                <Input
                  id={id(key)}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="any"
                  value={draft[key]}
                  aria-invalid={errors.salary ? true : undefined}
                  aria-describedby={errors.salary ? id("salary-error") : undefined}
                  onChange={(e) => set(key, e.target.value)}
                />
              </div>
            ))}
            <Field id={id("currency")} label={t("admin.form.currencyLabel")}>
              <Select value={draft.salaryCurrency} onChange={(e) => set("salaryCurrency", e.target.value)}>
                {CURRENCIES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {errors.salary && (
            <p id={id("salary-error")} className="jp-error" role="alert">
              <Icon name="alert" size={16} />
              {errors.salary}
            </p>
          )}
        </fieldset>
        <Field
          id={id("description")}
          label={t("admin.form.descriptionLabel")}
          required
          error={errors.description}
          className="jp-field--wide"
        >
          <Textarea rows={6} value={draft.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field id={id("requirements")} label={t("admin.form.requirementsLabel")} optional className="jp-field--wide">
          <Textarea rows={4} value={draft.requirements} onChange={(e) => set("requirements", e.target.value)} />
        </Field>
        <Field id={id("benefits")} label={t("admin.form.benefitsLabel")} optional className="jp-field--wide">
          <Textarea rows={4} value={draft.benefits} onChange={(e) => set("benefits", e.target.value)} />
        </Field>
      </div>
      <div className="jp-form-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("admin.form.cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const SERVER_FIELD_KEY = {
  title: "admin.form.serverTitle",
  companyId: "admin.form.serverCompany",
  location: "admin.form.serverLocation",
  categoryId: "admin.form.serverCategory",
  salary: "admin.form.serverSalary",
  description: "admin.form.serverDescription",
} as const satisfies Record<keyof Errors, string>;
