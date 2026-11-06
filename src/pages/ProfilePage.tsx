import { useId, useState, type FormEvent, type ReactNode } from "react";
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
  TopBar,
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
import type { Education, Profile, Skill, WorkExperience } from "../types/profile";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { queryKeys } from "../lib/queryClient";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const MISSING = "Chưa cập nhật";

type Errors = Record<string, string>;

export default function ProfilePage() {
  useDocumentTitle("Hồ sơ của tôi");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.profile(user?.id ?? ""),
    queryFn: () => fetchMyProfile(user!.id, user!.fullName),
    enabled: !!user,
    // Edits go through this page, so never show a cached copy from before them.
    staleTime: 0,
  });

  const profile = query.data;
  const failure = query.isError ? loadErrorMessage(query.error, "hồ sơ") : null;

  /** After any change, ask the backend again so the page shows what was really saved. */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: queryKeys.profile(user?.id ?? "") });
  }

  return (
    <>
      <TopBar />
      <main className="jp-page">
        <PageHead title="Hồ sơ của tôi" lead="Thông tin cá nhân, kỹ năng, kinh nghiệm và học vấn của bạn." />

        {query.isPending && <SkeletonBlock height={360} label="Đang tải hồ sơ" />}

        {failure && (
          <Alert
            tone="error"
            action={
              <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
                {query.isFetching ? "Đang thử lại…" : "Thử lại"}
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
              <ExperiencePanel userId={user.id} items={profile.experiences} onChange={refresh} />
              <EducationPanel userId={user.id} items={profile.education} onChange={refresh} />
            </div>
            <div className="jp-profile-side">
              <SkillPanel userId={user.id} skills={profile.skills} onChange={refresh} />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/* Personal information --------------------------------------------------------------------------- */

function InfoPanel({ profile, userId, fallbackName, onSaved }: {
  profile: Profile;
  userId: string;
  fallbackName: string;
  onSaved: () => Promise<void>;
}) {
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

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    const name = form.fullName.trim();
    if (name.length < 2) {
      setErrors({ fullName: "Họ tên cần từ 2 ký tự." });
      return;
    }
    setErrors({});
    setSaving(true);
    setServerErr(null);
    try {
      await updateMyProfile({ ...form, fullName: name }, userId);
      await onSaved();
      setEditing(false);
      setSaved(true);
    } catch (ex) {
      setServerErr(apiErrorMessage(ex, "Chưa lưu được hồ sơ. Vui lòng thử lại."));
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, ReactNode][] = [
    ["Họ tên", profile.fullName || fallbackName],
    ["Chức danh", profile.headline],
    ["Điện thoại", profile.phone],
    ["Địa chỉ", profile.address],
    ["Ngày sinh", formatDate(profile.dateOfBirth)],
  ];

  return (
    <Panel
      title="Thông tin cá nhân"
      actions={!editing ? <Button variant="secondary" icon="pencil" onClick={startEdit}>Sửa thông tin</Button> : undefined}
    >
      {saved && !editing && <Alert tone="success" className="jp-panel-alert">Đã lưu hồ sơ.</Alert>}

      {!editing ? (
        <>
          <dl className="jp-kv">
            {rows.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd className={value ? undefined : "jp-muted"}>{value || MISSING}</dd>
              </div>
            ))}
          </dl>
          <div className="jp-kv-summary">
            <h3 className="jp-label">Giới thiệu ngắn</h3>
            {profile.summary?.trim() ? <p className="jp-prose">{profile.summary}</p> : <p className="jp-muted">{MISSING}</p>}
          </div>
        </>
      ) : (
        <form className="jp-form-grid" onSubmit={save} noValidate>
          {serverErr && <Alert tone="error" className="jp-field--wide">{serverErr}</Alert>}
          <Field id="profile-name" label="Họ tên" required error={errors.fullName}>
            <Input value={form.fullName} maxLength={128} autoComplete="name" onChange={set("fullName")} />
          </Field>
          <Field id="profile-headline" label="Chức danh" optional>
            <Input value={form.headline} placeholder="Ví dụ: Lập trình viên Frontend" onChange={set("headline")} />
          </Field>
          <Field id="profile-phone" label="Điện thoại" optional>
            <Input value={form.phone} inputMode="tel" autoComplete="tel" onChange={set("phone")} />
          </Field>
          <Field id="profile-dob" label="Ngày sinh" optional>
            <Input type="date" value={form.dateOfBirth} autoComplete="bday" onChange={set("dateOfBirth")} />
          </Field>
          <Field id="profile-address" label="Địa chỉ" optional className="jp-field--wide">
            <Input value={form.address} autoComplete="street-address" onChange={set("address")} />
          </Field>
          <Field id="profile-summary" label="Giới thiệu ngắn" optional className="jp-field--wide">
            <Textarea rows={4} value={form.summary} onChange={set("summary")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Hủy</Button>
            <Button type="submit" loading={saving}>{saving ? "Đang lưu…" : "Lưu hồ sơ"}</Button>
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

function Section({ title, open, onToggle, empty, err, form, children, className }: {
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
          {open ? "Đóng" : "Thêm"}
        </Button>
      }
    >
      {err && <Alert tone="error" className="jp-panel-alert">{err}</Alert>}
      {empty ? <p className="jp-muted">{empty}</p> : children}
      <div id={formId}>{open && form}</div>
    </Panel>
  );
}

/** "3/2020 – nay" style range; a missing end date reads "từ …" rather than a dash. */
function range(start: string | null | undefined, end: string | null | undefined, current = false): string {
  const from = formatDate(start);
  const to = current ? "Hiện tại" : formatDate(end);
  if (from && to) return `${from} – ${to}`;
  if (from) return `Từ ${from}`;
  return to;
}

/* Skills ------------------------------------------------------------------------------------------- */

function SkillPanel({ userId, skills, onChange }: { userId: string; skills: Skill[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("3");
  const [years, setYears] = useState("1");
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Nhập tên kỹ năng.";
    const y = Number(years);
    if (!Number.isInteger(y) || y < 0 || y > 40) next.years = "Nhập số năm từ 0 đến 40.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", "Chưa thêm được kỹ năng. Vui lòng thử lại.", () =>
      addSkill(userId, { name: name.trim(), proficiency: Number(level), yearsOfExperience: y }),
    );
    if (ok) {
      setName("");
      setOpen(false);
    }
  }

  return (
    <Section
      title="Kỹ năng"
      open={open}
      onToggle={() => { setOpen((v) => !v); setErrors({}); setErr(null); }}
      empty={skills.length === 0 ? "Chưa có kỹ năng nào." : null}
      err={err}
      form={
        <form className="jp-addform" onSubmit={add} noValidate>
          <Field id="skill-name" label="Tên kỹ năng" required error={errors.name}>
            <Input value={name} placeholder="Ví dụ: React" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="skill-level" label="Mức thành thạo" hint="5/5 là thành thạo nhất.">
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
            </Select>
          </Field>
          <Field id="skill-years" label="Số năm kinh nghiệm" required error={errors.years}>
            <Input type="number" inputMode="numeric" min={0} max={40} value={years} onChange={(e) => setYears(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy === "add"}>{busy === "add" ? "Đang lưu…" : "Lưu kỹ năng"}</Button>
        </form>
      }
    >
      <ul className="jp-items">
        {skills.map((s) => (
          <li key={s.id} className="jp-item">
            <div className="jp-item-main">
              <strong className="jp-item-title">{s.name}</strong>
              <span className="jp-item-meta">Mức {s.proficiency}/5 · {s.yearsOfExperience} năm</span>
            </div>
            <Button
              variant="ghost"
              aria-label={`Xóa kỹ năng ${s.name}`}
              loading={busy === s.id}
              onClick={() => void run(s.id, "Chưa xóa được kỹ năng. Vui lòng thử lại.", () => deleteSkill(userId, s.id))}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Work experience ---------------------------------------------------------------------------------- */

const EMPTY_EXP = { company: "", title: "", startDate: "", endDate: "", isCurrent: false, description: "" };

function ExperiencePanel({ userId, items, onChange }: { userId: string; items: WorkExperience[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_EXP);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);
  const text = (key: "company" | "title" | "startDate" | "endDate" | "description") => (e: { target: { value: string } }) =>
    setF({ ...f, [key]: e.target.value });

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!f.company.trim()) next.company = "Nhập tên công ty.";
    if (!f.title.trim()) next.title = "Nhập chức danh.";
    if (!f.startDate) next.startDate = "Chọn ngày bắt đầu.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", "Chưa thêm được kinh nghiệm. Vui lòng thử lại.", () =>
      addExperience(userId, { ...f, company: f.company.trim(), title: f.title.trim(), endDate: f.isCurrent ? null : f.endDate }),
    );
    if (ok) {
      setF(EMPTY_EXP);
      setOpen(false);
    }
  }

  return (
    <Section
      title="Kinh nghiệm làm việc"
      open={open}
      onToggle={() => { setOpen((v) => !v); setErrors({}); setErr(null); }}
      empty={items.length === 0 ? "Chưa có kinh nghiệm nào." : null}
      err={err}
      form={
        <form className="jp-addform jp-form-grid" onSubmit={add} noValidate>
          <Field id="exp-company" label="Công ty" required error={errors.company}>
            <Input value={f.company} onChange={text("company")} />
          </Field>
          <Field id="exp-title" label="Chức danh" required error={errors.title}>
            <Input value={f.title} onChange={text("title")} />
          </Field>
          <Field id="exp-start" label="Bắt đầu" required error={errors.startDate}>
            <Input type="date" value={f.startDate} onChange={text("startDate")} />
          </Field>
          {!f.isCurrent && (
            <Field id="exp-end" label="Kết thúc" optional>
              <Input type="date" value={f.endDate} onChange={text("endDate")} />
            </Field>
          )}
          <div className="jp-field--wide">
            <Checkbox label="Đang làm việc ở đây" checked={f.isCurrent} onChange={(e) => setF({ ...f, isCurrent: e.target.checked })} />
          </div>
          <Field id="exp-desc" label="Mô tả ngắn" optional className="jp-field--wide">
            <Textarea rows={3} value={f.description} onChange={text("description")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button type="submit" loading={busy === "add"}>{busy === "add" ? "Đang lưu…" : "Lưu kinh nghiệm"}</Button>
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
              aria-label={`Xóa kinh nghiệm ${x.title}`}
              loading={busy === x.id}
              onClick={() => void run(x.id, "Chưa xóa được kinh nghiệm. Vui lòng thử lại.", () => deleteExperience(userId, x.id))}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* Education ---------------------------------------------------------------------------------------- */

const EMPTY_EDU = { institution: "", degree: "", field: "", startDate: "", endDate: "", grade: "" };

function EducationPanel({ userId, items, onChange }: { userId: string; items: Education[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY_EDU);
  const [errors, setErrors] = useState<Errors>({});
  const { busy, err, setErr, run } = useSectionAction(onChange);
  const text = (key: keyof typeof EMPTY_EDU) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value });

  async function add(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!f.institution.trim()) next.institution = "Nhập tên trường.";
    if (!f.degree.trim()) next.degree = "Nhập bằng cấp.";
    if (!f.field.trim()) next.field = "Nhập ngành học.";
    if (!f.startDate) next.startDate = "Chọn ngày bắt đầu.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = await run("add", "Chưa thêm được học vấn. Vui lòng thử lại.", () =>
      addEducation(userId, { ...f, institution: f.institution.trim(), degree: f.degree.trim(), field: f.field.trim() }),
    );
    if (ok) {
      setF(EMPTY_EDU);
      setOpen(false);
    }
  }

  return (
    <Section
      title="Học vấn"
      open={open}
      onToggle={() => { setOpen((v) => !v); setErrors({}); setErr(null); }}
      empty={items.length === 0 ? "Chưa có học vấn nào." : null}
      err={err}
      form={
        <form className="jp-addform jp-form-grid" onSubmit={add} noValidate>
          <Field id="edu-school" label="Trường" required error={errors.institution} className="jp-field--wide">
            <Input value={f.institution} onChange={text("institution")} />
          </Field>
          <Field id="edu-degree" label="Bằng cấp" required error={errors.degree} hint="Ví dụ: Cử nhân">
            <Input value={f.degree} onChange={text("degree")} />
          </Field>
          <Field id="edu-field" label="Ngành" required error={errors.field}>
            <Input value={f.field} onChange={text("field")} />
          </Field>
          <Field id="edu-start" label="Bắt đầu" required error={errors.startDate}>
            <Input type="date" value={f.startDate} onChange={text("startDate")} />
          </Field>
          <Field id="edu-end" label="Kết thúc" optional>
            <Input type="date" value={f.endDate} onChange={text("endDate")} />
          </Field>
          <Field id="edu-grade" label="Điểm trung bình" optional className="jp-field--wide">
            <Input value={f.grade} onChange={text("grade")} />
          </Field>
          <div className="jp-form-actions jp-field--wide">
            <Button type="submit" loading={busy === "add"}>{busy === "add" ? "Đang lưu…" : "Lưu học vấn"}</Button>
          </div>
        </form>
      }
    >
      <ul className="jp-items">
        {items.map((x) => (
          <li key={x.id} className="jp-item">
            <div className="jp-item-main">
              <strong className="jp-item-title">{x.degree} · {x.field}</strong>
              <span className="jp-item-sub">{x.institution}</span>
              <span className="jp-item-meta">
                {[range(x.startDate, x.endDate), x.grade ? `Điểm ${x.grade}` : ""].filter(Boolean).join(" · ")}
              </span>
            </div>
            <Button
              variant="ghost"
              aria-label={`Xóa học vấn ${x.institution}`}
              loading={busy === x.id}
              onClick={() => void run(x.id, "Chưa xóa được học vấn. Vui lòng thử lại.", () => deleteEducation(userId, x.id))}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
