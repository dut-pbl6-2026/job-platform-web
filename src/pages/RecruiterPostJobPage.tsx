import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, Field, Input, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import i18n from "../i18n";
import { apiErrorMessage } from "../lib/http";
import { createJob, fetchCategories, type JobCreatePayload } from "../lib/jobsApi";
import { employmentTypeLabel, experienceLevelLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import { showToast } from "../lib/toastBus";

// Values are the backend enum names (job-svc); labels come from labels.ts.
const EMPLOYMENT_TYPES = ["FullTime", "PartTime", "Contract", "Internship"] as const;

const EXPERIENCE_LEVELS = ["Entry", "Mid", "Senior", "Lead"] as const;

type Form = {
  title: string;
  description: string;
  location: string;
  categoryId: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  requirements: string;
  benefits: string;
};

const EMPTY: Form = {
  title: "",
  description: "",
  location: "",
  categoryId: "",
  employmentType: "FullTime",
  experienceLevel: "Entry",
  salaryMin: "",
  salaryMax: "",
  requirements: "",
  benefits: "",
};

type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.title.trim()) e.title = i18n.t("recruiter.post.validation.titleRequired");
  if (!f.description.trim()) e.description = i18n.t("recruiter.post.validation.descriptionRequired");
  if (!f.location.trim()) e.location = i18n.t("recruiter.post.validation.locationRequired");
  const min = f.salaryMin.trim() === "" ? null : Number(f.salaryMin);
  const max = f.salaryMax.trim() === "" ? null : Number(f.salaryMax);
  if (min !== null && (!Number.isFinite(min) || min < 0))
    e.salaryMin = i18n.t("recruiter.post.validation.salaryNotNegative");
  if (max !== null && (!Number.isFinite(max) || max < 0))
    e.salaryMax = i18n.t("recruiter.post.validation.salaryNotNegative");
  if (min !== null && max !== null && Number.isFinite(min) && Number.isFinite(max) && min > max) {
    e.salaryMax = i18n.t("recruiter.post.validation.salaryRange");
  }
  return e;
}

export default function RecruiterPostJobPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("recruiter.documentTitles.post"));
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories, staleTime: 5 * 60_000 });

  const submit = useMutation({
    mutationFn: (payload: JobCreatePayload) => createJob(payload),
    onSuccess: () => {
      showToast({ title: t("recruiter.post.published"), kind: "success" });
      navigate("/recruiter/jobs");
    },
  });

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const num = (s: string) => (s.trim() === "" ? null : Number(s));
    submit.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      companyId,
      location: form.location.trim(),
      salaryMin: num(form.salaryMin),
      salaryMax: num(form.salaryMax),
      salaryCurrency: "VND",
      categoryId: form.categoryId || null,
      requirements: form.requirements.trim() || null,
      benefits: form.benefits.trim() || null,
      employmentType: form.employmentType,
      experienceLevel: form.experienceLevel,
    });
  }

  return (
    <RecruiterShell title={t("recruiter.post.title")} lead={t("recruiter.post.lead")}>
      {!companyId && <Alert tone="warning">{t("recruiter.post.noCompany")}</Alert>}

      <form className="jp-recruiter-form" onSubmit={onSubmit} noValidate>
        <fieldset className="jp-recruiter-section">
          <legend>{t("recruiter.post.sectionJob")}</legend>
          <Field id="post-title" label={t("recruiter.post.titleLabel")} required error={errors.title}>
            <Input
              id="post-title"
              value={form.title}
              placeholder={t("recruiter.post.titlePlaceholder")}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          <Field
            id="post-description"
            label={t("recruiter.post.descriptionLabel")}
            required
            error={errors.description}
            hint={t("recruiter.post.descriptionHint")}
          >
            <Textarea
              id="post-description"
              rows={6}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field id="post-requirements" label={t("recruiter.post.requirementsLabel")} optional>
            <Textarea
              id="post-requirements"
              rows={4}
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
            />
          </Field>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>{t("recruiter.post.sectionCompany")}</legend>
          <Field id="post-location" label={t("recruiter.post.locationLabel")} required error={errors.location}>
            <Input
              id="post-location"
              value={form.location}
              placeholder={t("recruiter.post.locationPlaceholder")}
              onChange={(e) => set("location", e.target.value)}
            />
          </Field>
          <Field id="post-category" label={t("recruiter.post.categoryLabel")} optional>
            <Select id="post-category" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">{t("recruiter.post.notChosen")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>{t("recruiter.post.sectionSalary")}</legend>
          <div className="jp-recruiter-row">
            <Field id="post-salary-min" label={t("recruiter.post.salaryMinLabel")} optional error={errors.salaryMin}>
              <Input
                id="post-salary-min"
                inputMode="numeric"
                value={form.salaryMin}
                onChange={(e) => set("salaryMin", e.target.value)}
              />
            </Field>
            <Field id="post-salary-max" label={t("recruiter.post.salaryMaxLabel")} optional error={errors.salaryMax}>
              <Input
                id="post-salary-max"
                inputMode="numeric"
                value={form.salaryMax}
                onChange={(e) => set("salaryMax", e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>{t("recruiter.post.sectionType")}</legend>
          <div className="jp-recruiter-row">
            <Field id="post-employment" label={t("recruiter.post.employmentLabel")} required>
              <Select
                id="post-employment"
                value={form.employmentType}
                onChange={(e) => set("employmentType", e.target.value)}
              >
                {EMPLOYMENT_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {employmentTypeLabel(value)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="post-experience" label={t("recruiter.post.experienceLabel")} required>
              <Select
                id="post-experience"
                value={form.experienceLevel}
                onChange={(e) => set("experienceLevel", e.target.value)}
              >
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {experienceLevelLabel(level)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="jp-recruiter-section">
          <legend>{t("recruiter.post.sectionBenefits")}</legend>
          <Field
            id="post-benefits"
            label={t("recruiter.post.benefitsLabel")}
            optional
            hint={t("recruiter.post.benefitsHint")}
          >
            <Textarea
              id="post-benefits"
              rows={4}
              value={form.benefits}
              onChange={(e) => set("benefits", e.target.value)}
            />
          </Field>
        </fieldset>

        {submit.isError && (
          <Alert tone="error">{apiErrorMessage(submit.error, t("recruiter.post.submitFailed"))}</Alert>
        )}

        <div className="jp-recruiter-actions">
          <Button type="submit" loading={submit.isPending} disabled={!companyId}>
            {submit.isPending ? t("recruiter.post.publishing") : t("recruiter.post.publish")}
          </Button>
        </div>
      </form>
    </RecruiterShell>
  );
}
