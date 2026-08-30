import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";

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
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">JP</div>
          <div>
            <h1 className="auth-title">Đăng nhập</h1>
            <p className="auth-subtitle">Chào mừng trở lại Vietnam Job Platform</p>
          </div>
        </div>

        {err && <div className="alert alert-error" role="alert">{err}</div>}

        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className={`input ${fieldErr.email ? "error" : ""}`} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            <div className="help">{fieldErr.email ?? ""}</div>
          </div>

          <div className="field">
            <div className="row"><label className="label" htmlFor="pwd">Mật khẩu</label><button type="button" className="hint" style={{ background: "none", border: 0, cursor: "pointer", color: "#2563eb" }} onClick={() => setShow(s => !s)}>{show ? "Ẩn" : "Hiện"}</button></div>
            <input id="pwd" className={`input ${fieldErr.pwd ? "error" : ""}`} type={show ? "text" : "password"} placeholder="••••••••" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="current-password" />
            <div className="help">{fieldErr.pwd ?? ""}</div>
          </div>

          <button className="btn btn-primary" disabled={loading}>
            {loading && <span className="spinner" style={{ width: 16, height: 16, borderTopColor: "white" }} />} {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <div className="row" style={{ justifyContent: "center", fontSize: 13 }}>
            <span className="hint">Chưa có tài khoản?</span>
            <Link to="/register">Tạo tài khoản</Link>
          </div>
        </form>

        {/* <div className="hint" style={{ marginTop: 14, textAlign: "center" }}>
          API: <code>{import.meta.env.VITE_API_BASE_URL || "/api → http://localhost:5001"}</code>
        </div> */} 
      </div>
    </div>
  );
}
