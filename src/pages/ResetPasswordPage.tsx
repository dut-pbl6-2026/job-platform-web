import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { validatePassword } from "../lib/validation";

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const prefilled = useMemo(() => params.get("token") || "", [params]);
  const [token, setToken] = useState(prefilled);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!token.trim()) { setErr("Token là bắt buộc"); return; }
    const v = validatePassword(pwd);
    if (v) { setErr(v); return; }
    if (pwd !== confirm) { setErr("Xác nhận mật khẩu không khớp"); return; }
    setLoading(true);
    try {
      const m = await resetPassword(token.trim(), pwd);
      setMsg(m || "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
      setTimeout(() => nav("/login"), 1200);
    } catch (ex: any) {
      const status = ex?.response?.status;
      if (status === 401) setErr("Token không hợp lệ hoặc đã hết hạn");
      else setErr(ex?.response?.data?.message || "Đặt lại thất bại. Vui lòng thử lại.");
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">JP</div>
          <div>
            <h1 className="auth-title">Đặt lại mật khẩu</h1>
            <p className="auth-subtitle">Token dùng 1 lần, hiệu lực 15 phút</p>
          </div>
        </div>
        {err && <div className="alert alert-error" role="alert">{err}</div>}
        {msg && <div className="alert alert-success" role="status">{msg}</div>}
        <form className="form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label">Token</label>
            <input className="input" placeholder="Dán token từ email" value={token} onChange={e => setToken(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Mật khẩu mới</label>
            <input className="input" type="password" placeholder="8+ ký tự, 1 hoa, 1 số" value={pwd} onChange={e => setPwd(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="field">
            <label className="label">Xác nhận mật khẩu</label>
            <input className="input" type="password" placeholder="Nhập lại mật khẩu" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
          </button>
          <div className="row" style={{ justifyContent: "center", fontSize: 13 }}>
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
