import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Input } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail } from "../lib/validation";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.forgot.title"));
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
      await forgotPassword(email.trim());
      setMsg(t("auth.forgot.sent"));
    } catch (ex: unknown) {
      setErr(httpStatus(ex) === 429 ? t("auth.forgot.rateLimited") : apiErrorMessage(ex, t("auth.forgot.failed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.forgot.title")}
      lead={t("auth.forgot.lead")}
      footer={
        <Link className="jp-link" to="/login">
          {t("auth.forgot.backToLogin")}
        </Link>
      }
    >
      {err && <Alert tone="error">{err}</Alert>}
      {msg && <Alert tone="success">{msg}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field id="forgot-email" label={t("auth.register.emailLabel")} error={emailErr}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ten@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" block loading={loading}>
          {loading ? t("auth.forgot.submitting") : t("auth.forgot.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
