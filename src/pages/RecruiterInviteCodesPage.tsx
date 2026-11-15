import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, Panel } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../lib/dates";
import { httpStatus } from "../lib/http";
import { createInviteCode, type IssuedInviteCode } from "../lib/inviteApi";

/** Company creator issues single-use invite codes for new recruiters (SRS AUTH-01-09). */
export default function RecruiterInviteCodesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("invite.title"));
  const { user } = useAuth();
  const companyId = user?.companyId ?? "";
  const [issued, setIssued] = useState<IssuedInviteCode | null>(null);
  const [copied, setCopied] = useState(false);

  const create = useMutation({
    mutationFn: () => createInviteCode(companyId),
    onSuccess: (data) => {
      setIssued(data);
      setCopied(false);
    },
  });

  const errorText = create.isError
    ? httpStatus(create.error) === 403
      ? t("invite.notCreator")
      : t("invite.failed")
    : null;

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
        <div className="jp-invite">
          <Button type="button" onClick={() => create.mutate()} loading={create.isPending} disabled={!companyId}>
            {t("invite.create")}
          </Button>

          {issued && (
            <div className="jp-invite-result" role="status">
              <p className="jp-label">{t("invite.codeLabel")}</p>
              <code className="jp-invite-code">{issued.code}</code>
              <p className="jp-invite-expiry">{t("invite.expires", { date: formatDate(issued.expiresAt) })}</p>
              <Button type="button" variant="secondary" onClick={copyCode}>
                {copied ? t("invite.copied") : t("invite.copy")}
              </Button>
              <Alert tone="info">{t("invite.showOnce")}</Alert>
            </div>
          )}
        </div>
      </Panel>
    </RecruiterShell>
  );
}
