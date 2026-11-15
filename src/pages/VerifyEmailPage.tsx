import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, AuthLayout } from "../components/ui";
import { verifyEmail } from "../lib/api";
import { apiErrorMessage, httpStatus } from "../lib/http";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type Result =
  | { kind: "pending" }
  | { kind: "success" }
  | { kind: "invalid" }
  | { kind: "error"; message: string };

const INVALID_LINK = "This verification link is invalid, has expired or has already been used.";

/** Landing page of the link in the verification email: POST /api/auth/verify-email with the token from the URL. */
export default function VerifyEmailPage() {
  useDocumentTitle("Verify email");
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
        if (httpStatus(ex) === 400) setResult({ kind: "invalid" });
        else setResult({ kind: "error", message: apiErrorMessage(ex, "Xác thực thất bại. Vui lòng thử lại.") });
      });
  }, [token]);

  return (
    <AuthLayout
      title="Verify your email"
      footer={<Link className="jp-link" to="/login">Back to login</Link>}
    >
      {result.kind === "pending" && <Alert tone="info">Verifying your email…</Alert>}
      {result.kind === "success" && (
        <Alert tone="success">
          Your email has been verified. You can now <Link className="jp-link" to="/login">log in</Link>.
        </Alert>
      )}
      {result.kind === "invalid" && (
        <Alert tone="error">
          {INVALID_LINK} <Link className="jp-link" to="/login">Back to login</Link>
        </Alert>
      )}
      {result.kind === "error" && <Alert tone="error">{result.message}</Alert>}
    </AuthLayout>
  );
}
