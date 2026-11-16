import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Icon, Input, PasswordInput, PasswordRules, cx } from "../components/ui";
import i18n from "../i18n";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { toApiRole } from "../lib/roles";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { DEFAULT_AFTER_AUTH } from "../lib/redirect";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = Partial<Record<"inviteCode" | "fullName" | "email" | "pwd" | "confirm", string>>;

// Role values are the API contract; only `labelKey` is display copy.
const ROLE_OPTIONS = [
  { value: "User", labelKey: "auth.role.candidate" },
  { value: "Recruiter", labelKey: "auth.role.recruiter" },
] as const;

const INVITE_CODE_LENGTH = 12;

/** Users paste codes with dashes or lower case; the API takes the 12 characters only. */
function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * auth-svc: 422 = invalid, used or expired code (one message for all three); 400 on errors.InviteCode =
 * missing; 503 = job-svc could not check the code, so the registration was refused.
 */
function inviteErrorFrom(e: unknown): { onField: boolean; message: string } | null {
  const status = httpStatus(e);
  if (status === 422) return { onField: true, message: i18n.t("auth.register.inviteInvalid") };
  if (status === 400) {
    const errors = (e as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors;
    if (errors && Object.keys(errors).some((k) => k.toLowerCase() === "invitecode")) {
      return { onField: true, message: i18n.t("auth.register.needInviteCode") };
    }
  }
  if (status === 503) return { onField: false, message: i18n.t("auth.register.inviteUnavailable") };
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
  const [inviteCode, setInviteCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const apiRole = toApiRole(role);
  const isRecruiter = apiRole === "Recruiter";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const fe: FieldErrors = {};
    if (isRecruiter) {
      const code = normalizeInviteCode(inviteCode);
      if (!code) fe.inviteCode = t("auth.register.needInviteCode");
      else if (code.length !== INVITE_CODE_LENGTH) fe.inviteCode = t("auth.register.inviteInvalid");
    }
    const v1 = validateFullName(fullName);
    if (v1) fe.fullName = v1;
    const v2 = validateEmail(email);
    if (v2) fe.email = v2;
    const v3 = validatePassword(pwd);
    if (v3) fe.pwd = v3;
    if (pwd !== confirm) fe.confirm = t("auth.confirmMismatch");
    setFieldErr(fe);
    const order: [keyof FieldErrors, string][] = [
      ["inviteCode", "reg-invite"],
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
        ...(isRecruiter ? { inviteCode: normalizeInviteCode(inviteCode) } : {}),
      });
      // 202 either way. An invited Recruiter account is active at once and gets no verification
      // email (AUTH-01-15), so the notice must not ask for one; a User still has to verify.
      nav(`/login${query}`, {
        replace: true,
        state: isRecruiter
          ? { notice: t("auth.register.recruiterReadyNotice") }
          : { notice: t("auth.register.verifyNotice"), email: email.trim() },
      });
    } catch (ex: unknown) {
      const inviteErr = isRecruiter ? inviteErrorFrom(ex) : null;
      if (inviteErr?.onField) {
        setFieldErr({ inviteCode: inviteErr.message });
      } else if (inviteErr) {
        setErr(inviteErr.message);
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
          <br />
          {t("auth.register.companyPrompt")}{" "}
          <Link className="jp-link" to="/register-company">
            {t("auth.register.companyLink")}
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
          <Field
            id="reg-invite"
            label={t("auth.register.inviteCode")}
            required
            hint={t("auth.register.inviteHint")}
            error={fieldErr.inviteCode}
          >
            <Input
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </Field>
        )}

        <Field id="reg-name" label={t("auth.register.fullName")} required error={fieldErr.fullName}>
          <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        {/* A recruiter signs up with the address its invite code is bound to: auth-svc forwards this
            same email to job-svc check and redeem, so the two can never differ (AUTH-01-15). */}
        <Field
          id="reg-email"
          label={isRecruiter ? t("auth.register.inviteEmailLabel") : t("auth.register.emailLabel")}
          required
          hint={isRecruiter ? t("auth.register.inviteEmailHint") : undefined}
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
