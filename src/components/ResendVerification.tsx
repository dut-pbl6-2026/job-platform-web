import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Field, Input } from "./ui";
import { resendVerification } from "../lib/api";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { validateEmail } from "../lib/validation";

const COOLDOWN_MS = 60_000;

type Notice = { tone: "success" | "error"; text: string };

/**
 * Asks auth-svc for a new verification link. Pass `email` when the screen knows it (registration);
 * otherwise the component asks for it. The button is disabled for 60 seconds after a successful send.
 */
export function ResendVerification({ email }: { email?: string }) {
  const { t } = useTranslation();
  const [address, setAddress] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (cooldownEnd === null) return;
    const id = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      if (tick >= cooldownEnd) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownEnd]);

  const secondsLeft = cooldownEnd === null ? 0 : Math.max(0, Math.ceil((cooldownEnd - now) / 1000));

  async function onSend() {
    setNotice(null);
    let target = email?.trim() ?? "";
    if (!target) {
      target = address.trim();
      const invalid = validateEmail(target);
      setFieldError(invalid);
      if (invalid) return;
    }
    setSending(true);
    try {
      await resendVerification(target);
      const sentAt = Date.now();
      setNow(sentAt);
      setCooldownEnd(sentAt + COOLDOWN_MS);
      // The server answers 202 for every address, so the message says "if", never "sent".
      setNotice({ tone: "success", text: t("auth.resend.sent") });
    } catch (ex: unknown) {
      setNotice({
        tone: "error",
        text: httpStatus(ex) === 429 ? t("auth.resend.rateLimited") : apiErrorMessage(ex, t("auth.resend.sendFailed")),
      });
    } finally {
      setSending(false);
    }
  }

  const cooling = secondsLeft > 0;

  return (
    <div className="jp-resend">
      {!email && (
        <Field id="resend-email" label={t("auth.register.emailLabel")} error={fieldError ?? undefined}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
      )}
      <Button type="button" variant="secondary" block loading={sending} disabled={cooling} onClick={onSend}>
        {cooling ? t("auth.resend.countdown", { seconds: secondsLeft }) : t("auth.resend.send")}
      </Button>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
    </div>
  );
}
