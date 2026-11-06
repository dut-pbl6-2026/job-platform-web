import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AuthLayout, Button, Field, Icon, Input, PasswordInput, PasswordRules, cx } from "../components/ui";
import { CompanyPicker } from "../components/CompanyPicker";
import { useAuth } from "../contexts/AuthContext";
import { validateEmail, validateFullName, validatePassword } from "../lib/validation";
import { toApiRole } from "../lib/roles";
import { apiErrorMessage, httpStatus } from "../lib/http";
import type { CompanyOption } from "../lib/jobsApi";
import { DEFAULT_AFTER_AUTH } from "../lib/redirect";
import { useAuthRedirect } from "../hooks/useAuthRedirect";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

type FieldErrors = Partial<Record<"company" | "fullName" | "email" | "pwd" | "confirm", string>>;

const NEED_COMPANY = "Hãy chọn công ty bạn tuyển dụng cho.";
const COMPANY_GONE = "Công ty không còn tồn tại, hãy chọn lại.";

/** auth-svc answers 422 for an unknown company and 400 (errors.CompanyId) for a missing one. */
function companyErrorFrom(e: unknown): string | null {
  const status = httpStatus(e);
  if (status === 422) return COMPANY_GONE;
  if (status === 400) {
    const errors = (e as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors;
    if (errors && Object.keys(errors).some((k) => k.toLowerCase() === "companyid")) return NEED_COMPANY;
  }
  return null;
}

export default function RegisterPage() {
  useDocumentTitle("Đăng ký");
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
    if (isRecruiter && !company) fe.company = NEED_COMPANY;
    const v1 = validateFullName(fullName);
    if (v1) fe.fullName = v1;
    const v2 = validateEmail(email);
    if (v2) fe.email = v2;
    const v3 = validatePassword(pwd);
    if (v3) fe.pwd = v3;
    if (pwd !== confirm) fe.confirm = "Xác nhận mật khẩu không khớp";
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
      nav(target, { replace: true });
    } catch (ex: unknown) {
      const companyErr = isRecruiter ? companyErrorFrom(ex) : null;
      if (companyErr) {
        setFieldErr({ company: companyErr });
        if (httpStatus(ex) === 422) setCompany(null);
      } else if (httpStatus(ex) === 409) {
        setErr("Email này đã được đăng ký.");
      } else {
        setErr(apiErrorMessage(ex, "Đăng ký thất bại. Vui lòng thử lại."));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Tạo tài khoản"
      lead="Chọn vai trò rồi điền thông tin của bạn."
      footer={<>Đã có tài khoản? <Link className="jp-link" to={`/login${query}`}>Đăng nhập</Link></>}
    >
      {target !== DEFAULT_AFTER_AUTH && <Alert tone="info">Tạo tài khoản xong, bạn quay lại trang đang xem.</Alert>}
      {err && <Alert tone="error">{err}</Alert>}

      <form className="jp-form" onSubmit={onSubmit} noValidate>
        <fieldset className="jp-seg-field">
          <legend className="jp-label">Bạn là</legend>
          <div className="jp-seg">
            {[
              ["User", "Ứng viên"],
              ["Recruiter", "Nhà tuyển dụng"],
            ].map(([value, text]) => (
              <button
                key={value}
                type="button"
                className={cx("jp-seg-btn", role === value && "is-on")}
                aria-pressed={role === value}
                onClick={() => setRole(value)}
              >
                {role === value && <Icon name="check" size={16} />}
                {text}
              </button>
            ))}
          </div>
        </fieldset>

        {isRecruiter && (
          <CompanyPicker id="reg-company" label="Công ty bạn tuyển dụng cho" value={company} onChange={setCompany} error={fieldErr.company} />
        )}

        <Field id="reg-name" label="Họ và tên" required error={fieldErr.fullName}>
          <Input autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>

        <Field id="reg-email" label="Email" required error={fieldErr.email}>
          <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        <Field id="reg-pwd" label="Mật khẩu" required hint={<PasswordRules value={pwd} />} error={fieldErr.pwd}>
          <PasswordInput autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>

        <Field id="reg-confirm" label="Nhập lại mật khẩu" required error={fieldErr.confirm}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? "Đang tạo tài khoản…" : isRecruiter ? "Đăng ký nhà tuyển dụng" : "Đăng ký ứng viên"}
        </Button>
      </form>
    </AuthLayout>
  );
}
