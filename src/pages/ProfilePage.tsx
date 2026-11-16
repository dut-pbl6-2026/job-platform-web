import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import i18n from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Checkbox,
  Field,
  Input,
  PageHead,
  Panel,
  Select,
  SkeletonBlock,
  Textarea,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import {
  addEducation,
  addExperience,
  addSkill,
  deleteEducation,
  deleteExperience,
  deleteSkill,
  fetchMyProfile,
  updateMyProfile,
} from "../lib/profileApi";
import { fetchMyCompany } from "../lib/companyApi";
import { isAdmin, isRecruiter } from "../lib/roles";
import { roleLabel } from "../lib/labels";
import { safeHttpUrl } from "../lib/safeUrl";
import type { Education, Profile, Skill, WorkExperience } from "../types/profile";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Errors = Record<string, string>;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export default function ProfilePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("profile.title"));
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const admin = isAdmin(user?.role);
  const recruiter = isRecruiter(user?.role);
  const query = useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchMyProfile(user!.id, user!.fullName),
    enabled: !!user,
    // Edits go through this page, so never show a cached copy from before them.
    staleTime: 0,
  });
  const company = useQuery({
    queryKey: ["company", "mine", user?.id],
    queryFn: () => fetchMyCompany(user?.companyId),
    enabled: !!user && recruiter,
    staleTime: 60_000,
  });

  const profile = query.data;
  const failure = query.isError ? loadErrorMessage(query.error, t("profile.loadWhat")) : null;

  /** After any change, ask the backend again so the page shows what was really saved. */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id ?? "") });
  }

  return (
    <main className="jp-page">
      <PageHead title={t("profile.title")} lead={admin ? t("profile.leadAdmin") : t("profile.lead")} />

      {query.isPending && <SkeletonBlock height={360} label={t("profile.loading")} />}

      {failure && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
              {query.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {failure}
        </Alert>
      )}

      {profile && user && (
        <div className="jp-profile-grid">
          <div className="jp-profile-main">
            <InfoPanel profile={profile} userId={user.id} fallbackName={user.fullName} onSaved={refresh} />
            {!admin && (
              <>
                {recruiter && <p className="jp-profile-note jp-muted">{t("profile.cvOptional")}</p>}
                <ExperiencePanel userId={user.id} items={profile.experiences} onChange={refresh} />
                <EducationPanel userId={user.id} items={profile.education} onChange={refresh} />
              </>
            )}
          </div>
          <div className="jp-profile-side">
            <AccountPanel
              email={user.email}
              role={user.role}
              companyName={company.data?.company.name}
              showCompany={recruiter}
            />
            {!admin && <SkillPanel userId={user.id} skills={profile.skills} onChange={refresh} />}
          </div>
        </div>
      )}
    </main>
  );
}

/** Email, role and (for recruiters) the company, all read-only. */
function AccountPanel({
  email,
  role,
  companyName,
  showCompany,
}: {
  email: string;
  role: string;
  companyName?: string;
  showCompany: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Panel title={t("profile.account.title")}>
      <dl className="jp-kv">
        <div>
          <dt>{t("profile.account.email")}</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>{t("profile.account.role")}</dt>
          <dd>{roleLabel(role)}</dd>
        </div>
        {showCompany && (
          <div>
            <dt>{t("profile.account.company")}</dt>
            <dd>
              {companyName ? (
                <Link className="jp-link" to="/recruiter/company">
                  {companyName}
                </Link>
              ) : (
                <span className="jp-muted">{t("common.notProvided")}</span>
              )}
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}

/* Personal information --------------------------------------------------------------------------- */

function InfoPanel({
  profile,
  userId,
  fallbackName,
  onSaved,
}: {
  profile: Profile;
  userId: string;
  fallbackName: string;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState(() => formFrom(profile, fallbackName));

  function formFrom(p: Profile, name: string) {
    return {
      fullName: p.fullName || name,
      headline: p.headline || "",
      phone: p.phone || "",
      address: p.address || "",
      avatarUrl: p.avatarUrl || "",
      dateOfBirth: (p.dateOfBirth || "").slice(0, 10),
      summary: p.summary || "",
    };
  }

  function startEdit() {
    setForm(formFrom(profile, fallbackName));
    setErrors({});
    setServerErr(null);
    setSaved(false);
    setEditing(true);
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const name = form.fullName.trim();
    if (name.length < 2) {
      setErrors({ fullName: t("profile.info.nameTooShort") });
      return;
    }
    if (form.avatarUrl.trim() && !safeHttpUrl(form.avatarUrl)) {
      setErrors({ avatarUrl: t("profile.info.avatarInvalid") });
      return;
    }
    setErrors({});
    setSaving(true);
    setServerErr(null);
    try {
      await updateMyProfile({ ...form, fullName: name, avatarUrl: form.avatarUrl.trim() }, userId);
      await onSaved();
      setEditing(false);
      setSaved(true);
    } catch (ex) {
      setServerErr(apiErrorMessage(ex, t("profile.info.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  const avatar = safeHttpUrl(profile.avatarUrl);
  const editAvatar = safeHttpUrl(form.avatarUrl);

  const rows: [string, ReactNode][] = [
    [t("profile.info.headline"), profile.headline],
    [t("profile.info.phone"), profile.phone],
    [t("profile.info.address"), profile.address],
    [t("profile.info.dob"), formatDate(profile.dateOfBirth)],
  ];

  return (
    <Panel
      title={t("profile.info.title")}
      actions={
        !editing ? (
          <Button variant="secondary" icon="pencil" onClick={startEdit}>
            {t("profile.info.edit")}
          </Button>
        ) : undefined
      }
    >
      {saved && !editing && (
        <Alert tone="success" className="jp-panel-alert">
          {t("profile.info.saved")}
        </Alert>
      )}

      {!editing ? (
        <>
          <div className="jp-profile-identity">
            <span className="jp-profile-avatar" aria-hidden="true">
              {avatar ? (
                <img src={avatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                initials(profile.fullName || fallbackName)
              )}
            </span>
            <div>
              <strong>{profile.fullName || fallbackName}</strong>
              {profile.headline && <span className="jp-muted">{profile.headline}</span>}
            </div>
          </div>
          <dl className="jp-kv">
            {rows.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd className={value ? undefined : "jp-muted"}>{value || t("common.notProvided")}</dd>
              </div>
            ))}
          </dl>
          <div className="jp-kv-summary">
            <h3 className="jp-label">{t("profile.info.summary")}</h3>
            {profile.summary?.trim() ? (
              <p className="jp-prose">{profile.summary}</p>
            ) : (
              <p className="jp-muted">{t("common.notProvided")}</p>
            )}
          </div>
        </>
      ) : (
        <form className="jp-form-grid" onSubmit={save} noValidate>
          {serverErr && (
            <Alert tone="error" className="jp-field--wide">
              {serverErr}
            </Alert>
          )}
          <div className="jp-profile-avatar-edit jp-field--wide">
            <span className="jp-profile-avatar" aria-hidden="true">
              {editAvatar ? (
                <img src={editAvatar} alt="" referrerPolicy="no-referrer" />
              ) : (
                initials(form.fullName || fallbackName)
              )}
            </span>
            <Field
              id="profile-avatar"
              label={t("profile.info.avatar")}
              optional
              error={errors.avatarUrl}
              hint={t("profile.info.avatarHint")}
              className="jp-profile-avatar-field"
            >
              <Input
                value={form.avatarUrl}
                inputMode="url"
                placeholder="https://"
                maxLength={2048}
                onChange={set("avatarUrl")}
              />
            </Field>
          </div>
          <Field id="profile-name" label={t("profile.info.fullName")} required error={errors.fullName}>
            <Input value={form.fullName} maxLength={128} autoComplete="name" onChange={set("fullName")} />
          </Field>
          <Field id="profile-headline" label={t("profile.info.headline")} optional>
            <Input
              value={form.headline}
              placeholder={t("profile.info.headlinePlaceholder")}
              onChange={set("headline")}
            />
          </Field>
          <Field id="profile-phone" label={t("profile.info.phone")} optional>
            <Input value={form.phone} inputMode="tel" autoComplete="tel" onChange={set("phone")} />
          </Field>
          <Field id="profile-dob" label={t("profile.info.dob")} optional>
            <Input type="date" value={form.dateOfBirth} autoComplete="bday" onChange={set("dateOfBirth")} />
          </Field>
          <Field id="profile-address" label={t("profile.info.address")} optional className="jp-field--wide">
            <Input value={form.address} autoComplete="street-address" onChange={set("address")} />
          </Field>
          <Field id="profile-summary" label={t("profile.info.summary")} optional className="jp-field--wide">
            <Textarea rows={4} value={form.summary} onChange={set("summary")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              {t("profile.info.cancel")}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? t("profile.saving") : t("profile.info.save")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

/* Shared pieces of the three list sections -------------------------------------------------------- */

/** Runs a save or delete, then refreshes the page data. A failure stays on screen in the section. */
function useSectionAction(onChange: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run(key: string, fallback: string, job: () => Promise<unknown>): Promise<boolean> {
    setBusy(key);
    setErr(null);
    try {
      await job();
      await onChange();
      return true;
    } catch (e) {
      setErr(apiErrorMessage(e, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { busy, err, setErr, run };
}

function Section({
  title,
  open,
  onToggle,
  empty,
  err,
  form,
  children,
  className,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Shown instead of the list when there are no items. */
  empty: string | null;
  err: string | null;
  form: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const formId = useId();
  return (
    <Panel
      title={title}
      className={className}
      actions={
        <Button
          variant="secondary"
          icon={open ? "x" : "plus"}
          aria-expanded={open}
          aria-controls={formId}
          onClick={onToggle}
        >
          {open ? t("profile.close") : t("profile.add")}
        </Button>
      }
    >
      {err && (
        <Alert tone="error" className="jp-panel-alert">
          {err}
        </Alert>
      )}
      {empty ? <p className="jp-muted">{empty}</p> : children}
      <div id={formId}>{open && form}</div>
    </Panel>
  );
}

/** Date range such as "3/2020 – present"; a missing end date reads "from …" rather than a dash. */
function range(start: string | null | undefined, end: string | null | undefined, current = false): string {
  const from = formatDate(start);
  const to = current ? i18n.t("profile.present") : formatDate(end);
  if (from && to) return i18n.t("profile.range", { from, to });
  if (from) return i18n.t("profile.from", { date: from });
  return to;
}

/* Skills ------------------------------------------------------------------------------------------- */

function SkillPanel({ userId, skills, onChange }: { userId: string; skills: Skill[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("3");
  const [years, setYears] = useState("1");
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = t("profile.skills.nameRequired");
    const y = Number(years);
    if (!Number.isInteger(y) || y < 0 || y > 40) next.years = t("profile.skills.yearsInvalid");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", t("profile.skills.addFailed"), () =>
      addSkill(userId, { name: name.trim(), proficiency: Number(level), yearsOfExperience: y }),
    );
    if (ok) {
      setName("");
      setOpen(false);
    }
  }

  return (
    <Section
      title={t("profile.skills.title")}
      open={open}
      onToggle={() => {
        setOpen((v) => !v);
        setErrors({});
        setErr(null);
      }}
      empty={skills.length === 0 ? t("profile.skills.empty") : null}
      err={err}
      form={
        <form className="jp-addform" onSubmit={add} noValidate>
          <Field id="skill-name" label={t("profile.skills.name")} required error={errors.name}>
            <Input
              value={name}
              placeholder={t("profile.skills.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field id="skill-level" label={t("profile.skills.level")} hint={t("profile.skills.levelHint")}>
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}/5
                </option>
              ))}
            </Select>
          </Field>
          <Field id="skill-years" label={t("profile.skills.years")} required error={errors.years}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={40}
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </Field>
          <Button type="submit" loading={busy === "add"}>
            {busy === "add" ? t("profile.saving") : t("profile.skills.save")}
          </Button>
        </form>
      }
    >
      <ul className="jp-items">
        {skills.map((s) => (
          <li key={s.id} className="jp-item">
            <div className="jp-item-main">
              <strong className="jp-item-title">{s.name}</strong>
              <span className="jp-item-meta">
                {t("profile.skills.meta", { level: s.proficiency, years: s.yearsOfExperience })}
              </span>
            </div>
            <Button
              variant="ghost"
              aria-label={t("profile.skills.deleteLabel", { name: s.name })}
              loading={busy === s.id}
              onClick={() => void run(s.id, t("profile.skills.deleteFailed"), () => deleteSkill(userId, s.id))}
            >
              {t("profile.delete")}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Work experience ---------------------------------------------------------------------------------- */

const EMPTY_EXP = { company: "", title: "", startDate: "", endDate: "", isCurrent: false, description: "" };

function ExperiencePanel({
  userId,
  items,
  onChange,
}: {
  userId: string;
  items: WorkExperience[];
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_EXP);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);
  const text =
    (key: "company" | "title" | "startDate" | "endDate" | "description") => (e: { target: { value: string } }) =>
      setF({ ...f, [key]: e.target.value });

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!f.company.trim()) next.company = t("profile.experience.companyRequired");
    if (!f.title.trim()) next.title = t("profile.experience.titleRequired");
    if (!f.startDate) next.startDate = t("profile.experience.startRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", t("profile.experience.addFailed"), () =>
      addExperience(userId, {
        ...f,
        company: f.company.trim(),
        title: f.title.trim(),
        endDate: f.isCurrent ? null : f.endDate,
      }),
    );
    if (ok) {
      setF(EMPTY_EXP);
      setOpen(false);
    }
  }

  return (
    <Section
      title={t("profile.experience.title")}
      open={open}
      onToggle={() => {
        setOpen((v) => !v);
        setErrors({});
        setErr(null);
      }}
      empty={items.length === 0 ? t("profile.experience.empty") : null}
      err={err}
      form={
        <form className="jp-addform jp-form-grid" onSubmit={add} noValidate>
          <Field id="exp-company" label={t("profile.experience.company")} required error={errors.company}>
            <Input value={f.company} onChange={text("company")} />
          </Field>
          <Field id="exp-title" label={t("profile.experience.jobTitle")} required error={errors.title}>
            <Input value={f.title} onChange={text("title")} />
          </Field>
          <Field id="exp-start" label={t("profile.experience.start")} required error={errors.startDate}>
            <Input type="date" value={f.startDate} onChange={text("startDate")} />
          </Field>
          {!f.isCurrent && (
            <Field id="exp-end" label={t("profile.experience.end")} optional>
              <Input type="date" value={f.endDate} onChange={text("endDate")} />
            </Field>
          )}
          <div className="jp-field--wide">
            <Checkbox
              label={t("profile.experience.current")}
              checked={f.isCurrent}
              onChange={(e) => setF({ ...f, isCurrent: e.target.checked })}
            />
          </div>
          <Field id="exp-desc" label={t("profile.experience.description")} optional className="jp-field--wide">
            <Textarea rows={3} value={f.description} onChange={text("description")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button type="submit" loading={busy === "add"}>
              {busy === "add" ? t("profile.saving") : t("profile.experience.save")}
            </Button>
          </div>
        </form>
      }
    >
      <ul className="jp-items">
        {items.map((x) => (
          <li key={x.id} className="jp-item">
            <div className="jp-item-main">
              <strong className="jp-item-title">{x.title}</strong>
              <span className="jp-item-sub">{x.company}</span>
              <span className="jp-item-meta">{range(x.startDate, x.endDate, x.isCurrent)}</span>
              {x.description && <p className="jp-item-text">{x.description}</p>}
            </div>
            <Button
              variant="ghost"
              aria-label={t("profile.experience.deleteLabel", { title: x.title })}
              loading={busy === x.id}
              onClick={() => void run(x.id, t("profile.experience.deleteFailed"), () => deleteExperience(userId, x.id))}
            >
              {t("profile.delete")}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Education ---------------------------------------------------------------------------------------- */

const EMPTY_EDU = { institution: "", degree: "", field: "", startDate: "", endDate: "", grade: "" };

function EducationPanel({
  userId,
  items,
  onChange,
}: {
  userId: string;
  items: Education[];
  onChange: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_EDU);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);
  const text = (key: keyof typeof EMPTY_EDU) => (e: { target: { value: string } }) =>
    setF({ ...f, [key]: e.target.value });

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!f.institution.trim()) next.institution = t("profile.education.schoolRequired");
    if (!f.degree.trim()) next.degree = t("profile.education.degreeRequired");
    if (!f.field.trim()) next.field = t("profile.education.fieldRequired");
    if (!f.startDate) next.startDate = t("profile.education.startRequired");
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", t("profile.education.addFailed"), () =>
      addEducation(userId, { ...f, institution: f.institution.trim(), degree: f.degree.trim(), field: f.field.trim() }),
    );
    if (ok) {
      setF(EMPTY_EDU);
      setOpen(false);
    }
  }

  return (
    <Section
      title={t("profile.education.title")}
      open={open}
      onToggle={() => {
        setOpen((v) => !v);
        setErrors({});
        setErr(null);
      }}
      empty={items.length === 0 ? t("profile.education.empty") : null}
      err={err}
      form={
        <form className="jp-addform jp-form-grid" onSubmit={add} noValidate>
          <Field
            id="edu-school"
            label={t("profile.education.school")}
            required
            error={errors.institution}
            className="jp-field--wide"
          >
            <Input value={f.institution} onChange={text("institution")} />
          </Field>
          <Field
            id="edu-degree"
            label={t("profile.education.degree")}
            required
            error={errors.degree}
            hint={t("profile.education.degreeHint")}
          >
            <Input value={f.degree} onChange={text("degree")} />
          </Field>
          <Field id="edu-field" label={t("profile.education.field")} required error={errors.field}>
            <Input value={f.field} onChange={text("field")} />
          </Field>
          <Field id="edu-start" label={t("profile.education.start")} required error={errors.startDate}>
            <Input type="date" value={f.startDate} onChange={text("startDate")} />
          </Field>
          <Field id="edu-end" label={t("profile.education.end")} optional>
            <Input type="date" value={f.endDate} onChange={text("endDate")} />
          </Field>
          <Field id="edu-grade" label={t("profile.education.grade")} optional className="jp-field--wide">
            <Input value={f.grade} onChange={text("grade")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button type="submit" loading={busy === "add"}>
              {busy === "add" ? t("profile.saving") : t("profile.education.save")}
            </Button>
          </div>
        </form>
      }
    >
      <ul className="jp-items">
        {items.map((x) => (
          <li key={x.id} className="jp-item">
            <div className="jp-item-main">
              <strong className="jp-item-title">
                {x.degree} · {x.field}
              </strong>
              <span className="jp-item-sub">{x.institution}</span>
              <span className="jp-item-meta">
                {[range(x.startDate, x.endDate), x.grade ? t("profile.education.gradeNote", { grade: x.grade }) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            <Button
              variant="ghost"
              aria-label={t("profile.education.deleteLabel", { school: x.institution })}
              loading={busy === x.id}
              onClick={() => void run(x.id, t("profile.education.deleteFailed"), () => deleteEducation(userId, x.id))}
            >
              {t("profile.delete")}
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
