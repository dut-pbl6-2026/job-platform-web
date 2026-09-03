import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";

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

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; pwd?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe: typeof fieldErr = {};
    const e1 = validateEmail(email);
    if (e1) fe.email = e1;
    if (!pwd) fe.pwd = "Mật khẩu là bắt buộc";
    setFieldErr(fe);
    if (Object.keys(fe).length) return;

    setLoading(true);
    try {
      await login(email.trim(), pwd);
      nav("/dashboard");
    } catch (ex: any) {
      const msg = ex?.response?.data?.message || ex?.response?.data?.title || "";
      if (ex?.response?.status === 401) setErr("Email hoặc mật khẩu không đúng");
      else if (msg) setErr(msg);
      else setErr("Đăng nhập thất bại. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card--register">
        <h1 className="auth-title-large">Chào mừng trở lại</h1>
        <p className="auth-subtitle-large">Đăng nhập để tiếp tục tìm việc mơ ước</p>

        {err && <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>{err}</div>}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <div className={`input-wrap ${fieldErr.email ? "error" : ""}`}>
              <span className="input-icon"><IconMail /></span>
              <input id="email" className="input-field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="help">{fieldErr.email ?? ""}</div>
          </div>

          <div className="field">
            <div className={`input-wrap ${fieldErr.pwd ? "error" : ""}`}>
              <span className="input-icon"><IconLock /></span>
              <input id="pwd" className="input-field" type={show ? "text" : "password"} placeholder="Mật khẩu" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" />
              <button type="button" className="input-eye" onClick={() => setShow(s => !s)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>
                <IconEye off={show} />
              </button>
            </div>
            <div className="help">{fieldErr.pwd ?? ""}</div>
          </div>

          <button className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 4 }}>
            {loading && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />} {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div className="auth-footer">
            Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
