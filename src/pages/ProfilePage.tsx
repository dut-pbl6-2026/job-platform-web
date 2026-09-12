import { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
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

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", headline: "", summary: "", dateOfBirth: "" });

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchMyProfile(user.id, user.fullName)
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setForm({
          fullName: p.fullName || user.fullName,
          phone: p.phone || "",
          address: p.address || "",
          headline: p.headline || "",
          summary: p.summary || "",
          dateOfBirth: (p.dateOfBirth || "").slice(0, 10),
        });
      })
      .catch((e) => { if (alive) setErr(e?.message || "Không tải được hồ sơ"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.fullName.trim() || form.fullName.trim().length < 2) {
      setErr("Họ tên tối thiểu 2 ký tự");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await updateMyProfile({ ...form, fullName: form.fullName.trim() }, user.id);
      const next = await fetchMyProfile(user.id, form.fullName.trim());
      setProfile(next);
      setEditing(false);
      setOk("Đã lưu hồ sơ");
      setTimeout(() => setOk(null), 2500);
    } catch (ex: unknown) {
      const msg = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(msg || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    if (!user) return;
    const p = await fetchMyProfile(user.id, form.fullName || user.fullName);
    setProfile(p);
  }

  return (
    <>
      <AppHeader />
      <div className="container apply-wrap profile-page">
        <h1 className="page-h1">Hồ sơ của tôi</h1>
        <p className="hint page-lead">Nhà tuyển dụng đọc phần này trước CV.</p>
        {loading && <div className="skeleton-detail" />}
        {err && <div className="alert alert-error">{err}</div>}
        {ok && <div className="alert alert-success">{ok}</div>}
        {profile && !editing && (
          <div className="card">
            <div className="profile-head">
              <div>
                <h2 className="profile-name">{profile.fullName}</h2>
                <p className="hint">{profile.headline || "Chưa có chức danh"}</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => setEditing(true)}>Sửa thông tin</button>
            </div>
            <div className="kv-grid">
              <div><span className="hint">Điện thoại</span><strong>{profile.phone || "—"}</strong></div>
              <div><span className="hint">Địa chỉ</span><strong>{profile.address || "—"}</strong></div>
              <div><span className="hint">Ngày sinh</span><strong>{profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("vi-VN") : "—"}</strong></div>
            </div>
            <p className="detail-prewrap profile-summary">{profile.summary || "Chưa có giới thiệu"}</p>
          </div>
        )}
        {profile && editing && (
          <form className="card form" onSubmit={saveProfile}>
            <label className="label">Họ tên *</label>
            <input className="input" value={form.fullName} maxLength={128} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            <label className="label">Chức danh</label>
            <input className="input" placeholder="VD: Frontend Developer" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
            <label className="label">Điện thoại</label>
            <input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label className="label">Địa chỉ</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <label className="label">Ngày sinh</label>
            <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            <label className="label">Giới thiệu ngắn</label>
            <textarea className="textarea" rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            <div className="row">
              <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>Hủy</button>
              <button className="btn btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </form>
        )}

        {profile && user && (
          <>
            <SkillBlock userId={user.id} skills={profile.skills} onChange={refresh} />
            <ExpBlock userId={user.id} items={profile.experiences} onChange={refresh} />
            <EduBlock userId={user.id} items={profile.education} onChange={refresh} />
          </>
        )}
      </div>
    </>
  );
}

function SkillBlock({ userId, skills, onChange }: { userId: string; skills: Skill[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prof, setProf] = useState(3);
  const [years, setYears] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Nhập tên kỹ năng"); return; }
    setBusy(true); setErr(null);
    try {
      await addSkill(userId, { name: name.trim(), proficiency: prof, yearsOfExperience: years });
      setName(""); setOpen(false);
      await onChange();
    } catch { setErr("Thêm thất bại"); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="profile-head">
        <h2 className="section-h">Kỹ năng</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Đóng" : "Thêm"}</button>
      </div>
      {skills.length === 0 && <p className="hint">Chưa có kỹ năng. Bấm Thêm.</p>}
      <ul className="chip-list">
        {skills.map((s) => (
          <li key={s.id} className="skill-chip">
            {s.name} <span className="hint">· {s.proficiency}/5 · {s.yearsOfExperience} năm</span>
            <button type="button" className="chip-x" aria-label="Xóa" onClick={async () => { await deleteSkill(userId, s.id); await onChange(); }}>×</button>
          </li>
        ))}
      </ul>
      {open && (
        <form className="mini-form" onSubmit={add}>
          {err && <div className="help">{err}</div>}
          <input className="input" placeholder="Tên kỹ năng, VD: React" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="label">Mức thành thạo: {prof}/5</label>
          <input type="range" min={1} max={5} value={prof} onChange={(e) => setProf(Number(e.target.value))} />
          <label className="label">Số năm</label>
          <input className="input" type="number" min={0} max={40} value={years} onChange={(e) => setYears(Number(e.target.value))} />
          <button className="btn btn-primary" disabled={busy}>Lưu kỹ năng</button>
        </form>
      )}
    </section>
  );
}

function ExpBlock({ userId, items, onChange }: { userId: string; items: WorkExperience[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ company: "", title: "", startDate: "", endDate: "", isCurrent: false, description: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.company.trim() || !f.title.trim() || !f.startDate) { setErr("Điền công ty, chức danh, ngày bắt đầu"); return; }
    setBusy(true); setErr(null);
    try {
      await addExperience(userId, { ...f, company: f.company.trim(), title: f.title.trim(), endDate: f.isCurrent ? null : f.endDate });
      setF({ company: "", title: "", startDate: "", endDate: "", isCurrent: false, description: "" });
      setOpen(false);
      await onChange();
    } catch { setErr("Thêm thất bại"); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="profile-head">
        <h2 className="section-h">Kinh nghiệm</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Đóng" : "Thêm"}</button>
      </div>
      {items.length === 0 && <p className="hint">Chưa có kinh nghiệm. Bấm Thêm.</p>}
      <ul className="stack-list">
        {items.map((x) => (
          <li key={x.id} className="stack-item">
            <div>
              <strong>{x.title}</strong>
              <div className="hint">{x.company} · {x.startDate?.slice(0, 10)} → {x.isCurrent ? "Hiện tại" : (x.endDate?.slice(0, 10) || "—")}</div>
              {x.description && <p className="hint">{x.description}</p>}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await deleteExperience(userId, x.id); await onChange(); }}>Xóa</button>
          </li>
        ))}
      </ul>
      {open && (
        <form className="mini-form" onSubmit={add}>
          {err && <div className="help">{err}</div>}
          <input className="input" placeholder="Công ty" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <input className="input" placeholder="Chức danh" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <label className="label">Bắt đầu</label>
          <input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          <label className="row" style={{ justifyContent: "flex-start" }}>
            <input type="checkbox" checked={f.isCurrent} onChange={(e) => setF({ ...f, isCurrent: e.target.checked })} /> Đang làm việc
          </label>
          {!f.isCurrent && (
            <>
              <label className="label">Kết thúc</label>
              <input className="input" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </>
          )}
          <textarea className="textarea" rows={3} placeholder="Mô tả ngắn" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}>Lưu kinh nghiệm</button>
        </form>
      )}
    </section>
  );
}

function EduBlock({ userId, items, onChange }: { userId: string; items: Education[]; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ institution: "", degree: "", field: "", startDate: "", endDate: "", grade: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.institution.trim() || !f.degree.trim() || !f.field.trim() || !f.startDate) { setErr("Điền trường, bằng, ngành, ngày bắt đầu"); return; }
    setBusy(true); setErr(null);
    try {
      await addEducation(userId, { ...f, institution: f.institution.trim(), degree: f.degree.trim(), field: f.field.trim() });
      setF({ institution: "", degree: "", field: "", startDate: "", endDate: "", grade: "" });
      setOpen(false);
      await onChange();
    } catch { setErr("Thêm thất bại"); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <div className="profile-head">
        <h2 className="section-h">Học vấn</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Đóng" : "Thêm"}</button>
      </div>
      {items.length === 0 && <p className="hint">Chưa có học vấn. Bấm Thêm.</p>}
      <ul className="stack-list">
        {items.map((x) => (
          <li key={x.id} className="stack-item">
            <div>
              <strong>{x.degree} — {x.field}</strong>
              <div className="hint">{x.institution} · {x.startDate?.slice(0, 10)} → {x.endDate?.slice(0, 10) || "—"}{x.grade ? ` · ${x.grade}` : ""}</div>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await deleteEducation(userId, x.id); await onChange(); }}>Xóa</button>
          </li>
        ))}
      </ul>
      {open && (
        <form className="mini-form" onSubmit={add}>
          {err && <div className="help">{err}</div>}
          <input className="input" placeholder="Trường" value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} />
          <input className="input" placeholder="Bằng (VD: Cử nhân)" value={f.degree} onChange={(e) => setF({ ...f, degree: e.target.value })} />
          <input className="input" placeholder="Ngành" value={f.field} onChange={(e) => setF({ ...f, field: e.target.value })} />
          <label className="label">Bắt đầu</label>
          <input className="input" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          <label className="label">Kết thúc</label>
          <input className="input" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          <input className="input" placeholder="Điểm / GPA (không bắt buộc)" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}>Lưu học vấn</button>
        </form>
      )}
    </section>
  );
}
