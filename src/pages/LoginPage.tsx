import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AuthLayout, Button, Checkbox, Field, Input, PasswordInput } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { DEFAULT_AFTER_AUTH } from "../lib/redirect";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function LoginPage() {
  useDocumentTitle("Đăng nhập");
  const { login } = useAuth();
  const nav = useNavigate();
  const { target, query } = useAuthRedirect();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ email?: string; pwd?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe: typeof fieldErr = {};
    const e1 = validateEmail(email);
    if (e1) fe.email = e1;
    if (!pwd) fe.pwd = "Hãy nhập mật khẩu";
    setFieldErr(fe);
    if (fe.email || fe.pwd) {
      document.getElementById(fe.email ? "login-email" : "login-pwd")?.focus();
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), pwd, rememberMe);
      nav(target, { replace: true });
    } catch (ex: unknown) {
      setErr(httpStatus(ex) === 401 ? "Email hoặc mật khẩu không đúng." : apiErrorMessage(ex, "Đăng nhập thất bại. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Đăng nhập"
      lead="Đăng nhập để ứng tuyển và theo dõi đơn của bạn."
      footer={<>Chưa có tài khoản? <Link className="jp-link" to={`/register${query}`}>Tạo tài khoản</Link></>}
    >
      {target !== DEFAULT_AFTER_AUTH && <Alert tone="info">Đăng nhập xong, bạn quay lại trang đang xem.</Alert>}
      {err && <Alert tone="error">{err}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field id="login-email" label="Email" error={fieldErr.email}>
          <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field id="login-pwd" label="Mật khẩu" error={fieldErr.pwd}>
          <PasswordInput autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <div className="jp-form-row">
          <Checkbox label="Ghi nhớ tôi (30 ngày)" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
          <Link className="jp-link" to="/forgot-password">Quên mật khẩu?</Link>
        </div>

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>
    </AuthLayout>
  );
}
