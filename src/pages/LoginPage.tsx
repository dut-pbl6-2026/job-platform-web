import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Alert, AuthLayout, Button, Checkbox, Field, Input, PasswordInput } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { ResendVerification } from "../components/ResendVerification";
import { validateEmail } from "../lib/validation";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { defaultAfterAuth, resolveAfterAuth } from "../lib/redirect";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function LoginPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.login.title"));
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  // Set by RegisterPage: the account was created and must be verified before it can log in.
  const state = location.state as { notice?: unknown; email?: unknown } | null;
  const notice = state?.notice;
  // The address the account was registered with, so the user can ask for a new verification link.
  const registeredEmail = typeof state?.email === "string" ? state.email : undefined;
  const { query } = useAuthRedirect();
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
    if (!pwd) fe.pwd = t("auth.login.passwordRequired");
    setFieldErr(fe);
    if (fe.email || fe.pwd) {
      document.getElementById(fe.email ? "login-email" : "login-pwd")?.focus();
      return;
    }

    setLoading(true);
    try {
      const me = await login(email.trim(), pwd, rememberMe);
      nav(resolveAfterAuth(location.search, location.state, defaultAfterAuth(me.role)), { replace: true });
    } catch (ex: unknown) {
      // auth-svc answers 401 for a wrong password and for an unverified account alike, so the message names both.
      setErr(httpStatus(ex) === 401 ? t("auth.login.credentialsError") : apiErrorMessage(ex, t("auth.login.failed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.login.title")}
      lead={t("auth.login.lead")}
      footer={
        <>
          {t("auth.login.noAccount")}{" "}
          <Link className="jp-link" to={`/register${query}`}>
            {t("auth.login.createAccount")}
          </Link>
        </>
      }
    >
      {typeof notice === "string" && <Alert tone="success">{notice}</Alert>}
      {typeof notice === "string" && registeredEmail && <ResendVerification email={registeredEmail} />}
      {query && <Alert tone="info">{t("auth.login.afterLoginNotice")}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field id="login-email" label={t("auth.login.emailLabel")} error={fieldErr.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field id="login-pwd" label={t("auth.login.passwordLabel")} error={fieldErr.pwd}>
          <PasswordInput autoComplete="current-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <div className="jp-form-row">
          <Checkbox
            label={t("auth.login.remember")}
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <Link className="jp-link" to="/forgot-password">
            {t("auth.login.forgot")}
          </Link>
        </div>

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
