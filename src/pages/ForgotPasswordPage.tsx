import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const v = validateEmail(email);
    if (v) { setErr(v); return; }
    setLoading(true);
    try {
      const m = await forgotPassword(email.trim());
      setMsg(m || "Nếu email tồn tại, liên kết đặt lại đã được gửi");
    } catch (ex: any) {
      setErr(ex?.response?.data?.message || "Gửi yêu cầu thất bại. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">JP</div>
          <div>
            <h1 className="auth-title">Quên mật khẩu</h1>
            <p className="auth-subtitle">Nhập email để nhận liên kết đặt lại (15 phút)</p>
          </div>
        </div>
        {err && <div className="alert alert-error" role="alert">{err}</div>}
        {msg && <div className="alert alert-success" role="status">{msg}</div>}
        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input id="email" className="input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Đang gửi..." : "Gửi liên kết đặt lại"}
          </button>
          <div className="row" style={{ justifyContent: "center", fontSize: 13 }}>
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
