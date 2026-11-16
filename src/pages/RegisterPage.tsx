import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  AuthLayout,
  Button,
  Field,
  Icon,
  Input,
  PasswordInput,
  PasswordRules,
  WizardSteps,
  cx,
} from "../components/ui";
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
  { value: "User", labelKey: "auth.role.candidate", hintKey: "auth.register.roleCandidateHint" },
  { value: "Recruiter", labelKey: "auth.role.recruiter", hintKey: "auth.register.roleRecruiterHint" },
] as const;

const INVITE_CODE_LENGTH = 12;
const LAST_STEP = 2;

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

/**
 * Sign-up in three groups so nobody meets one long form: who you are (candidate, or recruiter with an
 * invite code), the credentials, then a review of exactly what will be created.
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.register.title"));
  const { register } = useAuth();
  const nav = useNavigate();
  const { target, query } = useAuthRedirect();
  const [step, setStep] = useState(0);
  const stepRef = useRef<HTMLHeadingElement>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<string>("User");
  const [inviteCode, setInviteCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const apiRole = toApiRole(role);
  const isRecruiter = apiRole === "Recruiter";

  // biome-ignore lint/correctness/useExhaustiveDependencies: step is the trigger; the effect only moves focus.
  useEffect(() => {
    stepRef.current?.focus();
  }, [step]);

  function validateStep(current: number): FieldErrors {
    const fe: FieldErrors = {};
    if (current === 0 && isRecruiter) {
      const code = normalizeInviteCode(inviteCode);
      if (!code) fe.inviteCode = t("auth.register.needInviteCode");
      else if (code.length !== INVITE_CODE_LENGTH) fe.inviteCode = t("auth.register.inviteInvalid");
    }
    if (current === 1 || current === LAST_STEP) {
      const v1 = validateFullName(fullName);
      if (v1) fe.fullName = v1;
      const v2 = validateEmail(email);
      if (v2) fe.email = v2;
      const v3 = validatePassword(pwd);
      if (v3) fe.pwd = v3;
      if (pwd !== confirm) fe.confirm = t("auth.confirmMismatch");
    }
    return fe;
  }

  function goNext() {
    const fe = validateStep(step);
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
    setErr(null);
    if (step === 0 && !isRecruiter) {
      setInviteCode("");
    }
    setStep((current) => Math.min(LAST_STEP, current + 1));
  }

  function goBack() {
    setErr(null);
    setFieldErr({});
    setStep((current) => Math.max(0, current - 1));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < LAST_STEP) {
      goNext();
      return;
    }

    const fe = validateStep(LAST_STEP);
    setFieldErr(fe);
    if (Object.keys(fe).length > 0) {
      setStep(1);
      return;
    }

    setErr(null);
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
        setStep(0);
      } else if (inviteErr) {
        setErr(inviteErr.message);
      } else if (httpStatus(ex) === 409) {
        setErr(t("auth.register.emailTaken"));
        setStep(1);
      } else {
        setErr(apiErrorMessage(ex, t("auth.register.failed")));
      }
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { title: t("auth.register.wizard.roleTitle"), hint: t("auth.register.wizard.roleHint") },
    { title: t("auth.register.wizard.credentialsTitle"), hint: t("auth.register.wizard.credentialsHint") },
    { title: t("auth.register.wizard.reviewTitle"), hint: t("auth.register.wizard.reviewHint") },
  ];

  const roleHint = ROLE_OPTIONS.find((option) => option.value === role)?.hintKey;

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

      <WizardSteps steps={steps} current={step} label={t("auth.register.wizard.label")} />

      <form className="jp-form jp-auth-wizard" onSubmit={onSubmit} noValidate>
        {step === 0 && (
          <section className="jp-wizard-pane" aria-labelledby="reg-step-role">
            <h2 className="jp-wizard-title" id="reg-step-role" ref={stepRef} tabIndex={-1}>
              {t("auth.register.wizard.roleQuestion")}
            </h2>
            <div className="jp-role-cards" role="radiogroup" aria-label={t("auth.role.prompt")}>
              {ROLE_OPTIONS.map(({ value, labelKey, hintKey }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={role === value}
                  className={cx("jp-role-card", role === value && "is-on")}
                  onClick={() => {
                    setRole(value);
                    setErr(null);
                  }}
                >
                  <span className="jp-role-card-icon" aria-hidden="true">
                    <Icon name={value === "Recruiter" ? "briefcase" : "users"} size={20} />
                  </span>
                  <span className="jp-role-card-text">
                    <strong>{t(labelKey)}</strong>
                    <span>{t(hintKey)}</span>
                  </span>
                  <span className="jp-role-card-check" aria-hidden="true">
                    {role === value && <Icon name="check" size={14} />}
                  </span>
                </button>
              ))}
            </div>

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
          </section>
        )}

        {step === 1 && (
          <section className="jp-wizard-pane" aria-labelledby="reg-step-credentials">
            <h2 className="jp-wizard-title" id="reg-step-credentials" ref={stepRef} tabIndex={-1}>
              {t("auth.register.wizard.credentialsTitle")}
            </h2>
            <p className="jp-wizard-lead">
              {isRecruiter ? t("auth.register.wizard.recruiterNote") : t("auth.register.wizard.candidateNote")}
            </p>

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
          </section>
        )}

        {step === 2 && (
          <section className="jp-wizard-pane" aria-labelledby="reg-step-review">
            <h2 className="jp-wizard-title" id="reg-step-review" ref={stepRef} tabIndex={-1}>
              {t("auth.register.wizard.reviewQuestion")}
            </h2>
            <p className="jp-wizard-lead">{t("auth.register.wizard.reviewLead")}</p>

            <dl className="jp-review-list">
              <div>
                <dt>{t("auth.role.prompt")}</dt>
                <dd>{t(isRecruiter ? "auth.role.recruiter" : "auth.role.candidate")}</dd>
              </div>
              <div>
                <dt>{t("auth.register.fullName")}</dt>
                <dd>{fullName.trim()}</dd>
              </div>
              <div>
                <dt>{t("auth.register.emailLabel")}</dt>
                <dd>{email.trim()}</dd>
              </div>
              {isRecruiter && (
                <div>
                  <dt>{t("auth.register.inviteCode")}</dt>
                  <dd>{normalizeInviteCode(inviteCode)}</dd>
                </div>
              )}
            </dl>

            <p className="jp-review-note">
              <Icon name="info" size={16} />
              {isRecruiter ? t("auth.register.recruiterReadyNotice") : t("auth.register.verifyNotice")}
            </p>
            {roleHint && <p className="jp-muted jp-auth-rolehint">{t(roleHint)}</p>}
          </section>
        )}

        <div className="jp-wizard-actions">
          <Button variant="secondary" type="button" icon="arrowLeft" onClick={goBack} disabled={step === 0 || loading}>
            {t("auth.register.back")}
          </Button>
          <span className="jp-wizard-progress">
            {t("auth.register.stepOf", { current: step + 1, total: steps.length })}
          </span>
          {step < LAST_STEP ? (
            <Button key="next" type="button" icon="arrowRight" onClick={goNext}>
              {t("auth.register.next")}
            </Button>
          ) : (
            <Button key="submit" type="submit" loading={loading}>
              {loading
                ? t("auth.register.submitting")
                : isRecruiter
                  ? t("auth.register.submitRecruiter")
                  : t("auth.register.submitCandidate")}
            </Button>
          )}
        </div>
      </form>
    </AuthLayout>
  );
}
