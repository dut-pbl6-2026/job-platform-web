import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Icon, Input, PasswordInput, PasswordRules, cx } from "../components/ui";
import { CompanyPicker } from "../components/CompanyPicker";
import i18n from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { toApiRole } from "../lib/roles";
import { apiErrorMessage, httpStatus } from "../lib/http";
import type { CompanyOption } from "../lib/jobsApi";
import { DEFAULT_AFTER_AUTH } from "../lib/redirect";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = Partial<Record<"company" | "fullName" | "email" | "pwd" | "confirm", string>>;

/** Shown on the login page after registering; the account cannot log in until the email is verified. */
const VERIFY_NOTICE = "Check your email to verify your account.";

// Role values are the API contract; only `labelKey` is display copy.
const ROLE_OPTIONS = [
  { value: "User", labelKey: "auth.role.candidate" },
  { value: "Recruiter", labelKey: "auth.role.recruiter" },
] as const;

/** auth-svc answers 422 for an unknown company and 400 (errors.CompanyId) for a missing one. */
function companyErrorFrom(e: unknown): string | null {
  const status = httpStatus(e);
  if (status === 422) return i18n.t("auth.register.companyGone");
  if (status === 400) {
    const errors = (e as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors;
    if (errors && Object.keys(errors).some((k) => k.toLowerCase() === "companyid")) {
      return i18n.t("auth.register.needCompany");
    }
  }
  return null;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.register.title"));
  const { register } = useAuth();
  const nav = useNavigate();
  const { target, query } = useAuthRedirect();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("User");
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const apiRole = toApiRole(role);
  const isRecruiter = apiRole === "Recruiter";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe: FieldErrors = {};
    if (isRecruiter && !company) fe.company = t("auth.register.needCompany");
    const v1 = validateFullName(fullName);
    if (v1) fe.fullName = v1;
    const v2 = validateEmail(email);
    if (v2) fe.email = v2;
    const v3 = validatePassword(pwd);
    if (v3) fe.pwd = v3;
    if (pwd !== confirm) fe.confirm = t("auth.confirmMismatch");
    setFieldErr(fe);
    const order: [keyof FieldErrors, string][] = [
      ["company", "reg-company"],
      ["fullName", "reg-name"],
      ["email", "reg-email"],
      ["pwd", "reg-pwd"],
      ["confirm", "reg-confirm"],
    ];
    const first = order.find(([key]) => fe[key]);
    if (first) {
      document.getElementById(first[1])?.focus();
      return;
    }

    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password: pwd,
        fullName: fullName.trim(),
        role: apiRole,
        ...(isRecruiter && company ? { companyId: company.id } : {}),
      });
      // 202: the account exists but is not verified yet. Send the user to login with the notice.
      nav(`/login${query}`, { replace: true, state: { notice: VERIFY_NOTICE, email: email.trim() } });
    } catch (ex: unknown) {
      const companyErr = isRecruiter ? companyErrorFrom(ex) : null;
      if (companyErr) {
        setFieldErr({ company: companyErr });
        if (httpStatus(ex) === 422) setCompany(null);
      } else if (httpStatus(ex) === 409) {
        setErr(t("auth.register.emailTaken"));
      } else {
        setErr(apiErrorMessage(ex, t("auth.register.failed")));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title={t("auth.register.title")}
      lead={t("auth.register.lead")}
      footer={
        <>
          {t("auth.register.haveAccount")}{" "}
          <Link className="jp-link" to={`/login${query}`}>
            {t("auth.register.loginLink")}
          </Link>
        </>
      }
    >
      {target !== DEFAULT_AFTER_AUTH && <Alert tone="info">{t("auth.register.afterAuthNotice")}</Alert>}
      {err && <Alert tone="error">{err}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <fieldset className="jp-seg-field">
          <legend className="jp-label">{t("auth.role.prompt")}</legend>
          <div className="jp-seg">
            {ROLE_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                className={cx("jp-seg-btn", role === value && "is-on")}
                aria-pressed={role === value}
                onClick={() => setRole(value)}
              >
                {role === value && <Icon name="check" size={16} />}
                {t(labelKey)}
              </button>
            ))}
          </div>
        </fieldset>

        {isRecruiter && (
          <CompanyPicker
            id="reg-company"
            label={t("auth.register.company")}
            value={company}
            onChange={setCompany}
            error={fieldErr.company}
          />
        )}

        <Field id="reg-name" label={t("auth.register.fullName")} required error={fieldErr.fullName}>
          <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field id="reg-email" label={t("auth.register.emailLabel")} required error={fieldErr.email}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field
          id="reg-pwd"
          label={t("auth.register.passwordLabel")}
          required
          hint={<PasswordRules value={pwd} />}
          error={fieldErr.pwd}
        >
          <PasswordInput autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <Field id="reg-confirm" label={t("auth.register.confirmPasswordLabel")} required error={fieldErr.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" block loading={loading}>
          {loading
            ? t("auth.register.submitting")
            : isRecruiter
              ? t("auth.register.submitRecruiter")
              : t("auth.register.submitCandidate")}
        </Button>
      </form>
    </AuthLayout>
  );
}
