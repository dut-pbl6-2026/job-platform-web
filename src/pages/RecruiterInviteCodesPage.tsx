import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, Field, Input, Panel } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../lib/dates";
import { httpStatus } from "../lib/http";
import { createInviteCode, type IssuedInviteCode } from "../lib/inviteApi";
import { validateEmail } from "../lib/validation";

/**
 * Company creator issues single-use invite codes for new recruiters (SRS AUTH-01-09, AUTH-01-15).
 * Each code is bound to one email address: the invited person must register with that address, and
 * auth-svc checks it on both the read-only check and the redeem.
 */
export default function RecruiterInviteCodesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("invite.title"));
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedInviteCode | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: (address: string) => createInviteCode(companyId, address),
    onSuccess: (data) => {
      setIssued(data);
      setCopied(false);
    },
  });

  const errorText = create.isError
    ? httpStatus(create.error) === 403
      ? t("invite.notCreator")
      : httpStatus(create.error) === 422
        ? t("invite.invalidEmail")
        : t("invite.failed")
    : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    const address = email.trim();
    const invalid = validateEmail(address);
    setEmailError(invalid);
    if (invalid) {
      document.getElementById("invite-email")?.focus();
      return;
    }
    setIssued(null);
    setCopied(false);
    create.mutate(address);
  }

  async function copyCode() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
    } catch {
      // Clipboard blocked: the code stays on screen for manual copy.
    }
  }

  return (
    <RecruiterShell title={t("invite.title")} lead={t("invite.lead")}>
      {!companyId && <Alert tone="warning">{t("invite.noCompany")}</Alert>}
      {errorText && <Alert tone="error">{errorText}</Alert>}

      <Panel>
        <form className="jp-invite" onSubmit={onSubmit} noValidate>
          <Field
            id="invite-email"
            label={t("invite.emailLabel")}
            required
            hint={t("invite.emailHint")}
            error={emailError}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
            />
          </Field>

          <div>
            <Button type="submit" loading={create.isPending} disabled={!companyId}>
              {create.isPending ? t("invite.creating") : t("invite.create")}
            </Button>
          </div>

          {issued && (
            <div className="jp-invite-result" role="status">
              <p className="jp-label">{t("invite.codeLabel")}</p>
              <code className="jp-invite-code">{issued.code}</code>
              <p className="jp-invite-expiry">{t("invite.forEmail", { email: issued.email })}</p>
              <p className="jp-invite-expiry">{t("invite.expires", { date: formatDate(issued.expiresAt) })}</p>
              <Button type="button" variant="secondary" onClick={copyCode}>
                {copied ? t("invite.copied") : t("invite.copy")}
              </Button>
              <Alert tone="info">{t("invite.showOnce")}</Alert>
            </div>
          )}
        </form>
      </Panel>
    </RecruiterShell>
  );
}
