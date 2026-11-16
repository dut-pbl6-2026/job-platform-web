import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, EmptyState, Field, Input, Panel, SkeletonBlock, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchMyCompany, updateCompany } from "../lib/companyApi";
import { companyInitials } from "../lib/jobsApi";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { safeHttpUrl } from "../lib/safeUrl";
import type { CompanyDetail, CompanyUpdate } from "../types/company";

const LIMITS = {
  name: 256,
  taxCode: 20,
  logoUrl: 2048,
  website: 2048,
  address: 512,
  industry: 128,
  size: 64,
} as const;

type Form = {
  name: string;
  taxCode: string;
  logoUrl: string;
  website: string;
  description: string;
  address: string;
  industry: string;
  size: string;
};

function toForm(c: CompanyDetail): Form {
  return {
    name: c.name,
    taxCode: c.taxCode ?? "",
    logoUrl: c.logoUrl ?? "",
    website: c.website ?? "",
    description: c.description ?? "",
    address: c.address ?? "",
    industry: c.industry ?? "",
    size: c.size ?? "",
  };
}

/** /recruiter/company — the company profile. Company Admin edits; Members read it with the reason. */
export default function RecruiterCompanyPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("company.recruiterDocumentTitle"));
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["company", "mine", user?.id],
    queryFn: () => fetchMyCompany(user?.companyId),
    enabled: !!user,
    staleTime: 0,
  });

  const data = query.data;
  const [saved, setSaved] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["company", "mine"] });
    setSaved(true);
  }

  return (
    <RecruiterShell title={t("company.recruiterTitle")} lead={t("company.recruiterLead")}>
      {query.isPending && <SkeletonBlock height={360} label={t("company.loading")} />}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
              {query.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(query.error, t("company.mineWhat"))}
        </Alert>
      )}

      {data === null && !query.isError && (
        <EmptyState title={t("company.noCompanyTitle")}>{t("company.noCompanyText")}</EmptyState>
      )}

      {data && (
        <div className="jp-company-settings">
          {saved && <Alert tone="success">{t("company.saved")}</Alert>}
          <CompanyHeader company={data.company} />

          {data.isCompanyAdmin ? (
            <CompanyEditor company={data.company} onSaved={refresh} />
          ) : (
            <MemberView company={data.company} />
          )}
        </div>
      )}
    </RecruiterShell>
  );
}

function CompanyHeader({ company }: { company: CompanyDetail }) {
  const { t } = useTranslation();
  const logo = safeHttpUrl(company.logoUrl);
  return (
    <div className="jp-company-settings-head">
      <span className="jp-company-logo" aria-hidden="true">
        {logo ? <img src={logo} alt="" referrerPolicy="no-referrer" /> : companyInitials(company.name)}
      </span>
      <div>
        <h2 className="jp-h2">{company.name}</h2>
        <p className="jp-muted">
          {[company.industry, company.size, company.address].filter(Boolean).join(" · ") || t("company.noFacts")}
        </p>
      </div>
      {company.verified && <span className="jp-company-verified">{t("company.verified")}</span>}
    </div>
  );
}

function MemberView({ company }: { company: CompanyDetail }) {
  const { t } = useTranslation();
  return (
    <Panel title={t("company.infoTitle")}>
      <Alert tone="info" className="jp-panel-alert">
        {t("company.memberReason")}
      </Alert>
      <fieldset className="jp-form-grid jp-company-fieldset" disabled aria-label={t("company.memberReadOnly")}>
        <Field id="company-name" label={t("company.name")}>
          <Input value={company.name} readOnly />
        </Field>
        <Field id="company-tax" label={t("company.taxCode")}>
          <Input value={company.taxCode ?? ""} readOnly />
        </Field>
        <Field id="company-industry" label={t("company.industry")}>
          <Input value={company.industry ?? ""} readOnly />
        </Field>
        <Field id="company-size" label={t("company.size")}>
          <Input value={company.size ?? ""} readOnly />
        </Field>
        <Field id="company-address" label={t("company.address")} className="jp-field--wide">
          <Input value={company.address ?? ""} readOnly />
        </Field>
        <Field id="company-website" label={t("company.website")} className="jp-field--wide">
          <Input value={company.website ?? ""} readOnly />
        </Field>
        <Field id="company-description" label={t("company.description")} className="jp-field--wide">
          <Textarea rows={5} value={company.description ?? ""} readOnly />
        </Field>
      </fieldset>
    </Panel>
  );
}

function CompanyEditor({ company, onSaved }: { company: CompanyDetail; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(() => toForm(company));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("company.nameRequired");
    if (form.logoUrl.trim() && !safeHttpUrl(form.logoUrl)) next.logoUrl = t("company.urlInvalid");
    if (form.website.trim() && !safeHttpUrl(form.website)) next.website = t("company.urlInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    setServerErr(null);
    const payload: CompanyUpdate = {
      name: form.name.trim(),
      taxCode: form.taxCode.trim(),
      logoUrl: form.logoUrl.trim(),
      website: form.website.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      industry: form.industry.trim(),
      size: form.size.trim(),
    };
    try {
      await updateCompany(company.id, payload);
      await onSaved();
    } catch (ex) {
      // Keep every field the user typed; only the message appears under the form.
      setServerErr(apiErrorMessage(ex, t("company.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={t("company.infoTitle")}>
      {serverErr && (
        <Alert tone="error" className="jp-panel-alert">
          {serverErr}
        </Alert>
      )}
      <form className="jp-form-grid" onSubmit={save} noValidate>
        <Field id="company-name" label={t("company.name")} required error={errors.name}>
          <Input value={form.name} maxLength={LIMITS.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field id="company-tax" label={t("company.taxCode")} optional error={errors.taxCode}>
          <Input value={form.taxCode} maxLength={LIMITS.taxCode} onChange={(e) => set("taxCode", e.target.value)} />
        </Field>
        <Field id="company-industry" label={t("company.industry")} optional error={errors.industry}>
          <Input value={form.industry} maxLength={LIMITS.industry} onChange={(e) => set("industry", e.target.value)} />
        </Field>
        <Field id="company-size" label={t("company.size")} optional error={errors.size}>
          <Input value={form.size} maxLength={LIMITS.size} onChange={(e) => set("size", e.target.value)} />
        </Field>
        <Field
          id="company-address"
          label={t("company.address")}
          optional
          className="jp-field--wide"
          error={errors.address}
        >
          <Input value={form.address} maxLength={LIMITS.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field
          id="company-logo"
          label={t("company.logoUrl")}
          optional
          className="jp-field--wide"
          error={errors.logoUrl}
          hint={t("company.logoHint")}
        >
          <Input value={form.logoUrl} maxLength={LIMITS.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
        </Field>
        <Field
          id="company-website"
          label={t("company.website")}
          optional
          className="jp-field--wide"
          error={errors.website}
          hint={t("company.websiteHint")}
        >
          <Input value={form.website} maxLength={LIMITS.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field
          id="company-description"
          label={t("company.description")}
          optional
          className="jp-field--wide"
          error={errors.description}
        >
          <Textarea rows={6} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="jp-form-actions jp-field--wide">
          <Button type="submit" loading={saving}>
            {saving ? t("company.saving") : t("company.save")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
