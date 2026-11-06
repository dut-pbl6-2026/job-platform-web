import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Input } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";
import { apiErrorMessage } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ForgotPasswordPage() {
  useDocumentTitle("Quên mật khẩu");
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const v = validateEmail(email);
    setEmailErr(v);
    if (v) {
      document.getElementById("forgot-email")?.focus();
      return;
    }
    setLoading(true);
    try {
      const m = await forgotPassword(email.trim());
      setMsg(m || "Nếu email tồn tại, liên kết đặt lại đã được gửi.");
    } catch (ex: unknown) {
      setErr(apiErrorMessage(ex, "Gửi yêu cầu thất bại. Vui lòng thử lại."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Quên mật khẩu"
      lead="Nhập email để nhận liên kết đặt lại mật khẩu. Liên kết có hiệu lực 15 phút."
      footer={<Link className="jp-link" to="/login">Quay lại đăng nhập</Link>}
    >
      {err && <Alert tone="error">{err}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field id="forgot-email" label="Email" error={emailErr}>
          <Input type="email" inputMode="email" autoComplete="email" placeholder="ten@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Đang gửi…" : "Gửi liên kết đặt lại"}
        </Button>
      </form>
    </AuthLayout>
  );
}
