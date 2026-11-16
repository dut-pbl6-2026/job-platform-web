import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import {
  Alert,
  Button,
  ButtonLink,
  EmptyState,
  Field,
  Icon,
  Input,
  Select,
  SkeletonBlock,
  Textarea,
  WizardSteps,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import i18n from "../i18n";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import {
  createJob,
  fetchCategories,
  fetchJobById,
  formatSalary,
  updateJob,
  type JobCreatePayload,
} from "../lib/jobsApi";
import { employmentTypeLabel, experienceLevelLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import { showToast } from "../lib/toastBus";
import { toBackendEmploymentType, toBackendExperienceLevel, type Job } from "../types/job";

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

const LAST_STEP = 2;

function formFromJob(job: Job): Form {
  return {
    title: job.title,
    description: job.description,
    location: job.location,
    categoryId: job.categoryId ?? "",
    employmentType: toBackendEmploymentType(job.employmentType),
    experienceLevel: toBackendExperienceLevel(job.experienceLevel),
    salaryMin: job.salaryMin > 0 ? String(job.salaryMin) : "",
    salaryMax: job.salaryMax > 0 ? String(job.salaryMax) : "",
    requirements: job.requirements ?? "",
    benefits: job.benefits ?? "",
  };
}

type Errors = Partial<Record<keyof Form, string>>;

/** Each step validates only its own fields; the final step re-checks everything before publishing. */
function validate(f: Form, step: number): Errors {
  const e: Errors = {};
  const basics = step === 0 || step === LAST_STEP;
  const description = step === 1 || step === LAST_STEP;
  const money = step === LAST_STEP;

  if (basics) {
    if (!f.title.trim()) e.title = i18n.t("recruiter.post.validation.titleRequired");
    if (!f.location.trim()) e.location = i18n.t("recruiter.post.validation.locationRequired");
  }

  if (description && !f.description.trim()) {
    e.description = i18n.t("recruiter.post.validation.descriptionRequired");
  }

  if (money) {
    const min = f.salaryMin.trim() === "" ? null : Number(f.salaryMin);
    const max = f.salaryMax.trim() === "" ? null : Number(f.salaryMax);
    if (min !== null && (!Number.isFinite(min) || min < 0))
      e.salaryMin = i18n.t("recruiter.post.validation.salaryNotNegative");
    if (max !== null && (!Number.isFinite(max) || max < 0))
      e.salaryMax = i18n.t("recruiter.post.validation.salaryNotNegative");
    if (min !== null && max !== null && Number.isFinite(min) && Number.isFinite(max) && min > max) {
      e.salaryMax = i18n.t("recruiter.post.validation.salaryRange");
    }
  }

  return e;
}

/**
 * Posting a job is three short steps: the facts a candidate filters by, the text they read, then the
 * salary and a preview of the finished card. Editing an existing job reuses the same steps.
 */
export default function RecruiterPostJobPage() {
  const { t } = useTranslation();
  const { jobId } = useParams();
  const editing = Boolean(jobId);
  useDocumentTitle(t(editing ? "recruiter.documentTitles.edit" : "recruiter.documentTitles.post"));
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState(false);
  const stepRef = useRef<HTMLLegendElement>(null);

  const categories = useQuery({ queryKey: queryKeys.categories, queryFn: fetchCategories, staleTime: 5 * 60_000 });
  const job = useQuery({
    queryKey: ["job", "edit", jobId ?? ""],
    queryFn: () => fetchJobById(jobId!),
    enabled: editing,
  });

  // Fill the form once the job loads; a later refetch must not overwrite the user's edits.
  useEffect(() => {
    if (!editing || prefilled || !job.data) return;
    setForm(formFromJob(job.data));
    setPrefilled(true);
  }, [editing, prefilled, job.data]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: step is the trigger; the effect only moves focus.
  useEffect(() => {
    stepRef.current?.focus();
  }, [step]);

  const companyId = (editing ? job.data?.companyId : undefined) ?? user?.companyId ?? "";

  const submit = useMutation({
    mutationFn: async (payload: JobCreatePayload) => {
      if (editing) {
        await updateJob(jobId!, payload);
        return;
      }
      await createJob(payload);
    },
    onSuccess: () => {
      showToast({
        title: t(editing ? "recruiter.post.saved" : "recruiter.post.published"),
        kind: "success",
      });
      navigate("/recruiter/jobs");
    },
  });

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function goNext() {
    const found = validate(form, step);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStep((current) => Math.min(LAST_STEP, current + 1));
  }

  function goBack() {
    setErrors({});
    setStep((current) => Math.max(0, current - 1));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId) return;
    if (step < LAST_STEP) {
      goNext();
      return;
    }

    const found = validate(form, LAST_STEP);
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

  const title = t(editing ? "recruiter.post.editTitle" : "recruiter.post.title");
  const lead = t(editing ? "recruiter.post.editLead" : "recruiter.post.lead");

  if (editing && job.isPending) {
    return (
      <RecruiterShell title={title} lead={lead}>
        <SkeletonBlock height={320} />
      </RecruiterShell>
    );
  }

  if (editing && job.isError) {
    return (
      <RecruiterShell title={title} lead={lead}>
        <Alert tone="error">{loadErrorMessage(job.error, t("recruiter.post.loadWhat"))}</Alert>
      </RecruiterShell>
    );
  }

  if (editing && job.data === null) {
    return (
      <RecruiterShell title={title} lead={lead}>
        <EmptyState
          title={t("recruiter.post.notFoundTitle")}
          action={<ButtonLink to="/recruiter/jobs">{t("recruiter.jobs.title")}</ButtonLink>}
        >
          {t("recruiter.post.notFoundText")}
        </EmptyState>
      </RecruiterShell>
    );
  }

  const steps = [
    { title: t("recruiter.post.wizard.basicsTitle"), hint: t("recruiter.post.wizard.basicsHint") },
    { title: t("recruiter.post.wizard.contentTitle"), hint: t("recruiter.post.wizard.contentHint") },
    { title: t("recruiter.post.wizard.publishTitle"), hint: t("recruiter.post.wizard.publishHint") },
  ];
  const categoryName = (categories.data ?? []).find((category) => category.id === form.categoryId)?.name;
  const salaryPreview = formatSalary(Number(form.salaryMin) || 0, Number(form.salaryMax) || 0, "VND");

  return (
    <RecruiterShell title={title} lead={lead}>
      {!companyId && <Alert tone="warning">{t("recruiter.post.noCompany")}</Alert>}

      <WizardSteps steps={steps} current={step} label={t("recruiter.post.wizard.label")} />

      <form className="jp-recruiter-form jp-wizard-card" onSubmit={onSubmit} noValidate>
        {step === 0 && (
          <section className="jp-wizard-pane" aria-labelledby="post-step-basics">
            <fieldset className="jp-recruiter-section">
              <legend id="post-step-basics" ref={stepRef} tabIndex={-1}>
                {t("recruiter.post.wizard.basicsTitle")}
              </legend>
              <p className="jp-wizard-lead">{t("recruiter.post.wizard.basicsLead")}</p>

              <Field id="post-title" label={t("recruiter.post.titleLabel")} required error={errors.title}>
                <Input
                  id="post-title"
                  value={form.title}
                  placeholder={t("recruiter.post.titlePlaceholder")}
                  onChange={(e) => set("title", e.target.value)}
                />
              </Field>

              <Field id="post-location" label={t("recruiter.post.locationLabel")} required error={errors.location}>
                <Input
                  id="post-location"
                  value={form.location}
                  placeholder={t("recruiter.post.locationPlaceholder")}
                  onChange={(e) => set("location", e.target.value)}
                />
              </Field>

              <div className="jp-recruiter-row">
                <Field id="post-category" label={t("recruiter.post.categoryLabel")} optional>
                  <Select
                    id="post-category"
                    value={form.categoryId}
                    onChange={(e) => set("categoryId", e.target.value)}
                  >
                    <option value="">{t("recruiter.post.notChosen")}</option>
                    {(categories.data ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
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
              </div>

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
            </fieldset>
          </section>
        )}

        {step === 1 && (
          <section className="jp-wizard-pane" aria-labelledby="post-step-content">
            <fieldset className="jp-recruiter-section">
              <legend id="post-step-content" ref={stepRef} tabIndex={-1}>
                {t("recruiter.post.wizard.contentTitle")}
              </legend>
              <p className="jp-wizard-lead">{t("recruiter.post.wizard.contentLead")}</p>

              <Field
                id="post-description"
                label={t("recruiter.post.descriptionLabel")}
                required
                error={errors.description}
                hint={t("recruiter.post.descriptionHint")}
              >
                <Textarea
                  id="post-description"
                  rows={7}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>

              <Field id="post-requirements" label={t("recruiter.post.requirementsLabel")} optional>
                <Textarea
                  id="post-requirements"
                  rows={5}
                  value={form.requirements}
                  onChange={(e) => set("requirements", e.target.value)}
                />
              </Field>

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
          </section>
        )}

        {step === 2 && (
          <section className="jp-wizard-pane" aria-labelledby="post-step-publish">
            <fieldset className="jp-recruiter-section">
              <legend id="post-step-publish" ref={stepRef} tabIndex={-1}>
                {t("recruiter.post.wizard.publishTitle")}
              </legend>
              <p className="jp-wizard-lead">{t("recruiter.post.wizard.publishLead")}</p>

              <div className="jp-recruiter-row">
                <Field
                  id="post-salary-min"
                  label={t("recruiter.post.salaryMinLabel")}
                  optional
                  error={errors.salaryMin}
                >
                  <Input
                    id="post-salary-min"
                    inputMode="numeric"
                    value={form.salaryMin}
                    onChange={(e) => set("salaryMin", e.target.value)}
                  />
                </Field>
                <Field
                  id="post-salary-max"
                  label={t("recruiter.post.salaryMaxLabel")}
                  optional
                  error={errors.salaryMax}
                >
                  <Input
                    id="post-salary-max"
                    inputMode="numeric"
                    value={form.salaryMax}
                    onChange={(e) => set("salaryMax", e.target.value)}
                  />
                </Field>
              </div>
              <p className="jp-muted jp-salary-note">{t("recruiter.post.wizard.salaryNote")}</p>
            </fieldset>

            <div className="jp-post-preview">
              <p className="jp-post-preview-label">{t("recruiter.post.wizard.previewTitle")}</p>
              <article className="jp-jobcard jp-post-preview-card">
                <div className="jp-jobcard-top">
                  <span className="jp-jobcard-logo" aria-hidden="true">
                    {form.title.trim().charAt(0).toUpperCase() || "?"}
                  </span>
                  <span className="jp-jobcard-company">{categoryName || t("recruiter.post.notChosen")}</span>
                </div>
                <h3 className="jp-jobcard-title">{form.title.trim() || t("recruiter.post.wizard.previewUntitled")}</h3>
                <p className="jp-jobcard-salary">{salaryPreview}</p>
                <div className="jp-jobcard-meta">
                  <span>
                    <Icon name="pin" size={14} />
                    {form.location.trim() || t("recruiter.post.wizard.previewNoLocation")}
                  </span>
                  <span>
                    <Icon name="briefcase" size={14} />
                    {employmentTypeLabel(form.employmentType)}
                  </span>
                  <span>
                    <Icon name="chart" size={14} />
                    {experienceLevelLabel(form.experienceLevel)}
                  </span>
                </div>
                {form.description.trim() && (
                  <p className="jp-post-preview-desc">{form.description.trim().slice(0, 180)}…</p>
                )}
              </article>
            </div>
          </section>
        )}

        {submit.isError && (
          <Alert tone="error">{apiErrorMessage(submit.error, t("recruiter.post.submitFailed"))}</Alert>
        )}

        <div className="jp-wizard-actions">
          <Button
            variant="secondary"
            type="button"
            icon="arrowLeft"
            onClick={goBack}
            disabled={step === 0 || submit.isPending}
          >
            {t("recruiter.post.wizard.back")}
          </Button>
          <span className="jp-wizard-progress">
            {t("recruiter.post.wizard.progress", { current: step + 1, total: steps.length })}
          </span>
          {step < LAST_STEP ? (
            <Button key="next" type="button" icon="arrowRight" onClick={goNext}>
              {t("recruiter.post.wizard.next")}
            </Button>
          ) : (
            <Button key="submit" type="submit" loading={submit.isPending} disabled={!companyId}>
              {editing
                ? submit.isPending
                  ? t("recruiter.post.saving")
                  : t("recruiter.post.save")
                : submit.isPending
                  ? t("recruiter.post.publishing")
                  : t("recruiter.post.publish")}
            </Button>
          )}
        </div>
      </form>
    </RecruiterShell>
  );
}
