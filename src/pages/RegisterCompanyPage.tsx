import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Input, PasswordInput, PasswordRules } from "../components/ui";
import { registerCompany } from "../lib/api";
import { apiErrorCode, apiErrorMessage, httpStatus } from "../lib/http";
import { validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = Partial<Record<"fullName" | "companyName" | "taxCode" | "email" | "pwd" | "confirm", string>>;

/**
 * Company self-serve sign-up (SRS AUTH-01-10, AUTH-01-11): the founding admin creates a Company with
 * a work email. The server answers 202 for every business outcome, so after a successful call the
 * page shows one fixed "check your email" copy and never says whether the company or the address
 * already exists. The waiting room is the mailbox: nothing exists until the link is verified.
 */
export default function RegisterCompanyPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("companySignup.documentTitle"));
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function submit() {
    setErr(null);
    setRetryable(false);
    const fe: FieldErrors = {};
    const vName = validateFullName(fullName);
    if (vName) fe.fullName = vName;
    if (!companyName.trim()) fe.companyName = t("validation.companyNameRequired");
    else if (companyName.trim().length > 200) fe.companyName = t("validation.companyNameTooLong");
    if (taxCode.trim().length > 32) fe.taxCode = t("validation.taxCodeTooLong");
    const vEmail = validateEmail(email);
    if (vEmail) fe.email = vEmail;
    const vPwd = validatePassword(pwd);
    if (vPwd) fe.pwd = vPwd;
    if (pwd !== confirm) fe.confirm = t("auth.confirmMismatch");
    setFieldErr(fe);
    const order: [keyof FieldErrors, string][] = [
      ["fullName", "company-name"],
      ["companyName", "company-company"],
      ["taxCode", "company-tax"],
      ["email", "company-email"],
      ["pwd", "company-pwd"],
      ["confirm", "company-confirm"],
    ];
    const first = order.find(([key]) => fe[key]);
    if (first) {
      document.getElementById(first[1])?.focus();
      return;
    }

    setLoading(true);
    try {
      await registerCompany({
        companyName: companyName.trim(),
        ...(taxCode.trim() ? { taxCode: taxCode.trim() } : {}),
        email: email.trim(),
        password: pwd,
        fullName: fullName.trim(),
      });
      // 202 for every outcome: the page must not read the body (English) or infer which case applied.
      setAccepted(true);
    } catch (ex: unknown) {
      if (httpStatus(ex) === 422 && apiErrorCode(ex) === "WORK_EMAIL_REQUIRED") {
        setFieldErr({ email: t("companySignup.workEmailRequired") });
        document.getElementById("company-email")?.focus();
      } else if (httpStatus(ex) === 503) {
        // A job-svc lookup failed and nothing was stored: the same request may succeed later.
        setErr(t("companySignup.unavailable"));
        setRetryable(true);
      } else {
        setErr(apiErrorMessage(ex, t("companySignup.failed")));
      }
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  if (accepted) {
    return (
      <AuthLayout
        title={t("companySignup.title")}
        footer={
          <Link className="jp-link" to="/login">
            {t("companySignup.loginLink")}
          </Link>
        }
      >
        <Alert tone="success">{t("companySignup.accepted")}</Alert>
        <p className="jp-hint">{t("companySignup.acceptedHint")}</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("companySignup.title")}
      lead={t("companySignup.lead")}
      footer={
        <>
          {t("companySignup.notCompany")}{" "}
          <Link className="jp-link" to="/register">
            {t("companySignup.backToRegister")}
          </Link>
        </>
      }
    >
      {err && (
        <Alert
          tone="error"
          action={
            retryable ? (
              <Button variant="secondary" loading={loading} onClick={() => void submit()}>
                {loading ? t("companySignup.submitting") : t("companySignup.retry")}
              </Button>
            ) : undefined
          }
        >
          {err}
        </Alert>
      )}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <Field id="company-name" label={t("companySignup.fullName")} required error={fieldErr.fullName}>
          <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field id="company-company" label={t("companySignup.companyName")} required error={fieldErr.companyName}>
          <Input autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </Field>

        <Field
          id="company-tax"
          label={t("companySignup.taxCode")}
          optional
          hint={t("companySignup.taxCodeHint")}
          error={fieldErr.taxCode}
        >
          <Input value={taxCode} onChange={(e) => setTaxCode(e.target.value)} />
        </Field>

        <Field
          id="company-email"
          label={t("companySignup.emailLabel")}
          required
          hint={t("companySignup.emailHint")}
          error={fieldErr.email}
        >
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field
          id="company-pwd"
          label={t("companySignup.passwordLabel")}
          required
          hint={<PasswordRules value={pwd} />}
          error={fieldErr.pwd}
        >
          <PasswordInput autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <Field id="company-confirm" label={t("companySignup.confirmPasswordLabel")} required error={fieldErr.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? t("companySignup.submitting") : t("companySignup.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
