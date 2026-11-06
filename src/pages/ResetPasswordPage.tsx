import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Input, PasswordInput, PasswordRules } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { validatePassword } from "../lib/validation";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = { token?: string; pwd?: string; confirm?: string };

export default function ResetPasswordPage() {
  useDocumentTitle("Đặt lại mật khẩu");
  const { resetPassword } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const prefilled = useMemo(() => params.get("token") || "", [params]);
  const [token, setToken] = useState(prefilled);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [err, setErr] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const redirectTimer = useRef<number>();

  // Leaving the page before the redirect fires must not navigate afterwards.
  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setExpired(false);
    setMsg(null);
    const fe: FieldErrors = {};
    if (!token.trim()) fe.token = "Hãy dán mã đặt lại từ email";
    const v = validatePassword(pwd);
    if (v) fe.pwd = v;
    if (pwd !== confirm) fe.confirm = "Xác nhận mật khẩu không khớp";
    setFieldErr(fe);
    const firstBad = fe.token ? "reset-token" : fe.pwd ? "reset-pwd" : fe.confirm ? "reset-confirm" : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }
    setLoading(true);
    try {
      const m = await resetPassword(token.trim(), pwd);
      setMsg(m || "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
      redirectTimer.current = window.setTimeout(() => nav("/login"), 1200);
    } catch (ex: unknown) {
      if (httpStatus(ex) === 401) {
        setExpired(true);
        setErr("Mã đặt lại không hợp lệ hoặc đã hết hạn.");
      } else {
        setErr(apiErrorMessage(ex, "Đặt lại thất bại. Vui lòng thử lại."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Đặt lại mật khẩu"
      lead="Mã đặt lại dùng được một lần và có hiệu lực 15 phút."
      footer={<Link className="jp-link" to="/login">Quay lại đăng nhập</Link>}
    >
      {err && (
        <Alert tone="error" action={expired ? <Link className="jp-link" to="/forgot-password">Nhận liên kết mới</Link> : undefined}>
          {err}
        </Alert>
      )}
      {msg && <Alert tone="success">{msg}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field
          id="reset-token"
          label="Mã đặt lại"
          required
          hint={prefilled ? "Đã điền từ liên kết trong email." : "Dán mã trong email đặt lại mật khẩu."}
          error={fieldErr.token}
        >
          <Input autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>

        <Field id="reset-pwd" label="Mật khẩu mới" required hint={<PasswordRules value={pwd} />} error={fieldErr.pwd}>
          <PasswordInput autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <Field id="reset-confirm" label="Nhập lại mật khẩu mới" required error={fieldErr.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" block loading={loading} disabled={!!msg}>
          {loading ? "Đang xử lý…" : "Đặt lại mật khẩu"}
        </Button>
      </form>
    </AuthLayout>
  );
}
