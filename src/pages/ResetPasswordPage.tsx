import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Input, PasswordInput, PasswordRules } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { validatePassword } from "../lib/validation";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = { token?: string; pwd?: string; confirm?: string };

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.reset.title"));
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
  const redirectTimer = useRef<number | undefined>(undefined);

  // Leaving the page before the redirect fires must not navigate afterwards.
  useEffect(() => () => window.clearTimeout(redirectTimer.current), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setExpired(false);
    setMsg(null);
    const fe: FieldErrors = {};
    if (!token.trim()) fe.token = t("auth.reset.tokenRequired");
    const v = validatePassword(pwd);
    if (v) fe.pwd = v;
    if (pwd !== confirm) fe.confirm = t("auth.confirmMismatch");
    setFieldErr(fe);
    const firstBad = fe.token ? "reset-token" : fe.pwd ? "reset-pwd" : fe.confirm ? "reset-confirm" : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token.trim(), pwd);
      setMsg(t("auth.reset.success"));
      redirectTimer.current = window.setTimeout(() => nav("/login"), 1200);
    } catch (ex: unknown) {
      if (httpStatus(ex) === 401) {
        setExpired(true);
        setErr(t("auth.reset.invalidToken"));
      } else {
        setErr(apiErrorMessage(ex, t("auth.reset.failed")));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.reset.title")}
      lead={t("auth.reset.lead")}
      footer={
        <Link className="jp-link" to="/login">
          {t("auth.reset.backToLogin")}
        </Link>
      }
    >
      {err && (
        <Alert
          tone="error"
          action={
            expired ? (
              <Link className="jp-link" to="/forgot-password">
                {t("auth.reset.getNewLink")}
              </Link>
            ) : undefined
          }
        >
          {err}
        </Alert>
      )}
      {msg && <Alert tone="success">{msg}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field
          id="reset-token"
          label={t("auth.reset.tokenLabel")}
          required
          hint={prefilled ? t("auth.reset.tokenPrefilled") : t("auth.reset.tokenHint")}
          error={fieldErr.token}
        >
          <Input autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>

        <Field
          id="reset-pwd"
          label={t("auth.reset.newPasswordLabel")}
          required
          hint={<PasswordRules value={pwd} />}
          error={fieldErr.pwd}
        >
          <PasswordInput autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <Field id="reset-confirm" label={t("auth.reset.confirmNewPasswordLabel")} required error={fieldErr.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" block loading={loading} disabled={!!msg}>
          {loading ? t("auth.reset.submitting") : t("auth.reset.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
