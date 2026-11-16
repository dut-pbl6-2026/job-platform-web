import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, AuthLayout } from "../components/ui";
import { ResendVerification } from "../components/ResendVerification";
import { verifyEmail } from "../lib/api";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Result = { kind: "pending" } | { kind: "success" } | { kind: "invalid" } | { kind: "error"; message: string };

/** Landing page of the link in the verification email: POST /api/auth/verify-email with the token from the URL. */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.verifyEmail.documentTitle"));
  const [params] = useSearchParams();
  const token = params.get("token")?.trim() ?? "";
  const [result, setResult] = useState<Result>(token ? { kind: "pending" } : { kind: "invalid" });
  // StrictMode runs effects twice in development and a verification token works only once,
  // so the same token must not be sent twice.
  const sentToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token || sentToken.current === token) return;
    sentToken.current = token;
    verifyEmail(token)
      .then(() => setResult({ kind: "success" }))
      .catch((ex: unknown) => {
        // A bad, expired or already used token is 422 VERIFICATION_TOKEN_INVALID (auth-svc).
        if (httpStatus(ex) === 422) setResult({ kind: "invalid" });
        else setResult({ kind: "error", message: apiErrorMessage(ex, t("auth.verify.failed")) });
      });
  }, [token, t]);

  return (
    <AuthLayout
      title={t("auth.verifyEmail.title")}
      footer={
        <Link className="jp-link" to="/login">
          {t("auth.verifyEmail.backToLogin")}
        </Link>
      }
    >
      {result.kind === "pending" && <Alert tone="info">{t("auth.verifyEmail.verifying")}</Alert>}
      {result.kind === "success" && (
        <Alert tone="success">
          {t("auth.verifyEmail.successBefore")}{" "}
          <Link className="jp-link" to="/login">
            {t("auth.verifyEmail.successLogin")}
          </Link>
          {t("auth.verifyEmail.successAfter")}
        </Alert>
      )}
      {result.kind === "invalid" && (
        <Alert tone="error">
          {t("auth.verifyEmail.invalid")}{" "}
          <Link className="jp-link" to="/login">
            {t("auth.verifyEmail.backToLogin")}
          </Link>
        </Alert>
      )}
      {result.kind === "invalid" && <ResendVerification />}
      {result.kind === "error" && <Alert tone="error">{result.message}</Alert>}
    </AuthLayout>
  );
}
