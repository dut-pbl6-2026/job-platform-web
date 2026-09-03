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

// Icons as inline SVG for pixel-perfect match
function IconUserCard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 8h3M7 12h10M9 16a3 3 0 0 1 6 0" />
      <circle cx="15.5" cy="7.5" r="1.5" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      <circle cx="12" cy="15.5" r="1.2" />
    </svg>
  );
}
function IconConfirm() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5a7 7 0 1 0 5.2 2.2" />
      <path d="M12 5V3M12 5l-2 2M16 9l2-2M16 9v2M9 14l2 2 4-5" />
    </svg>
  );
}
function IconEye({ off }: { off?: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 3l18 18M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6M9.9 5.2A10.7 10.7 0 0 1 12 4c5 0 8.5 6 8.5 6a13.6 13.6 0 0 1-2.2 3M4.5 9a13 13 0 0 0-1 1S6 16 12 16a10.1 10.1 0 0 0 2.1-.3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6-11-6-11-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconBuilding() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M9 9h6M9 13h6M9 17h6M3 9h3M3 13h3M3 17h3" />
    </svg>
  );
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
  const [showConfirm, setShowConfirm] = useState(false);
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

  const btnLabel = role === "Recruiter" ? "Đăng ký Nhà tuyển dụng" : "Đăng ký Ứng viên";

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--register">
        <h1 className="auth-title-large">Tạo tài khoản mới</h1>
        <p className="auth-subtitle-large">Tham gia nền tảng tuyển dụng và tìm việc hàng đầu</p>

        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>{err}</div>}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div>
            <div className="role-label">Bạn là ai?</div>
            <div className="role-switch" role="group" aria-label="Chọn vai trò">
              <button
                type="button"
                className={`role-btn ${role === "User" ? "active" : ""}`}
                onClick={() => setRole("User")}
              >
                Ứng viên
              </button>
              <button
                type="button"
                className={`role-btn ${role === "Recruiter" ? "active" : ""}`}
                onClick={() => setRole("Recruiter")}
              >
                <span style={{ display: "inline-flex" }}></span> Nhà tuyển dụng
              </button>
            </div>
          </div>

          <div className="field">
            <div className={`input-wrap ${fieldErr.fullName ? "error" : ""}`}>
              <span className="input-icon"><IconUserCard /></span>
              <input className="input-field" placeholder="Họ và tên" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="help">{fieldErr.fullName ?? ""}</div>
          </div>

          <div className="field">
            <div className={`input-wrap ${fieldErr.email ? "error" : ""}`}>
              <span className="input-icon"><IconMail /></span>
              <input className="input-field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="help">{fieldErr.email ?? ""}</div>
          </div>

          <div className="field">
            <div className={`input-wrap ${fieldErr.pwd ? "error" : ""}`}>
              <span className="input-icon"><IconLock /></span>
              <input className="input-field" type={show ? "text" : "password"} placeholder="Mật khẩu" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" />
              <button type="button" className="input-eye" onClick={() => setShow(s => !s)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                <IconEye off={show} />
              </button>
            </div>
            {pwd ? (
              <>
                <div className="pwd-meter"><span style={{ width: `${meter.score}%`, background: meter.color }} /></div>
                <div className="hint" style={{ marginTop: 2 }}>Độ mạnh: {meter.label}</div>
              </>
            ) : null}
            <div className="help">{fieldErr.pwd ?? ""}</div>
          </div>

          <div className="field">
            <div className={`input-wrap ${fieldErr.confirm ? "error" : ""}`}>
              <span className="input-icon"><IconConfirm /></span>
              <input className="input-field" type={showConfirm ? "text" : "password"} placeholder="Xác nhận mật khẩu" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              <button type="button" className="input-eye" onClick={() => setShowConfirm(s => !s)} aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                <IconEye off={showConfirm} />
              </button>
            </div>
            <div className="help">{fieldErr.confirm ?? ""}</div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 4 }}>
            {loading && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />} {loading ? "Đang tạo..." : btnLabel}
          </button>

          <div className="auth-footer">
            Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
