import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { toApiRole } from "../lib/roles";

function strength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: "", color: "#e2e8f0" };
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/\d/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (pwd.length >= 12) s++;
  const pct = Math.min(100, (s / 5) * 100);
  const label = s <= 2 ? "Yếu" : s === 3 ? "Trung bình" : s >= 4 ? "Mạnh" : "Yếu";
  const color = s <= 2 ? "#ef4444" : s === 3 ? "#f59e0b" : "#16a34a";
  return { score: pct, label, color };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("User");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const meter = useMemo(() => strength(pwd), [pwd]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe: Record<string, string> = {};
    const v1 = validateFullName(fullName); if (v1) fe.fullName = v1;
    const v2 = validateEmail(email); if (v2) fe.email = v2;
    const v3 = validatePassword(pwd); if (v3) fe.pwd = v3;
    if (pwd !== confirm) fe.confirm = "Xác nhận mật khẩu không khớp";
    if (Object.keys(fe).length) { setFieldErr(fe); return; }
    setFieldErr({});
    setLoading(true);
    try {
      await register({ email: email.trim(), password: pwd, fullName: fullName.trim(), role: toApiRole(role) });
      nav("/dashboard");
    } catch (ex: any) {
      const data = ex?.response?.data;
      const status = ex?.response?.status;
      if (status === 409) setErr("Email đã được đăng ký");
      else if (data?.message) setErr(data.message);
      else setErr("Đăng ký thất bại. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">JP</div>
          <div>
            <h1 className="auth-title">Tạo tài khoản</h1>
            <p className="auth-subtitle">Tham gia Vietnam Job Platform — miễn phí</p>
          </div>
        </div>

        {err && <div className="alert alert-error">{err}</div>}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label">Họ và tên</label>
            <input className={`input ${fieldErr.fullName ? "error" : ""}`} placeholder="Nguyen Van A" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
            <div className="help">{fieldErr.fullName ?? ""}</div>
          </div>

          <div className="field">
            <label className="label">Email</label>
            <input className={`input ${fieldErr.email ? "error" : ""}`} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <div className="help">{fieldErr.email ?? ""}</div>
          </div>

          <div className="field">
            <label className="label">Vai trò</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="User">Ứng viên (User)</option>
              <option value="Recruiter">Nhà tuyển dụng (Recruiter)</option>
              {/* Employer kept as alias for backward compat, mapped to Recruiter via toApiRole */}
            </select>
            <span className="hint">SRS ROLES-01: User / Recruiter / Admin — Employer là alias cũ của Recruiter</span>
          </div>

          <div className="field">
            <div className="row"><label className="label">Mật khẩu</label><button type="button" style={{ background: "none", border: 0, cursor: "pointer", color: "#2563eb", fontSize: 12 }} onClick={() => setShow(s => !s)}>{show ? "Ẩn" : "Hiện"}</button></div>
            <input className={`input ${fieldErr.pwd ? "error" : ""}`} type={show ? "text" : "password"} placeholder="8+ ký tự, 1 hoa, 1 số" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" />
            <div className="pwd-meter"><span style={{ width: `${meter.score}%`, background: meter.color }} /></div>
            <div className="row"><span className="hint">{pwd ? `Độ mạnh: ${meter.label}` : "Mật khẩu 8+ ký tự, 1 chữ hoa, 1 số (SRS AUTH-01)"}</span></div>
            <div className="help">{fieldErr.pwd ?? ""}</div>
          </div>

          <div className="field">
            <label className="label">Xác nhận mật khẩu</label>
            <input className={`input ${fieldErr.confirm ? "error" : ""}`} type={show ? "text" : "password"} placeholder="Nhập lại mật khẩu" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            <div className="help">{fieldErr.confirm ?? ""}</div>
          </div>

          <button className="btn btn-primary" disabled={loading}>
            {loading && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />} {loading ? "Đang tạo..." : "Tạo tài khoản"}
          </button>

          <div className="row" style={{ justifyContent: "center", fontSize: 13 }}>
            <span className="hint">Đã có tài khoản?</span>
            <Link to="/login">Đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
