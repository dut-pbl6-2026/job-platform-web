import i18n from "../i18n";

// SRS AUTH-01: pwd 8+1upper+1num
export const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

/** The same rule as `passwordRegex`, one line per requirement, so the form can show them before the first error. */
export const PASSWORD_RULES: {
  id: string;
  labelKey: "validation.passwordRules.length" | "validation.passwordRules.upper" | "validation.passwordRules.digit";
  test: (v: string) => boolean;
}[] = [
  { id: "length", labelKey: "validation.passwordRules.length", test: (v) => v.length >= 8 },
  { id: "upper", labelKey: "validation.passwordRules.upper", test: (v) => /[A-Z]/.test(v) },
  { id: "digit", labelKey: "validation.passwordRules.digit", test: (v) => /\d/.test(v) },
];

export function validateEmail(v: string): string | null {
  if (!v.trim()) return i18n.t("validation.emailRequired");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return i18n.t("validation.emailInvalid");
  if (v.length > 256) return i18n.t("validation.emailTooLong");
  return null;
}
export function validatePassword(v: string): string | null {
  if (!v) return i18n.t("validation.passwordRequired");
  if (!passwordRegex.test(v)) return i18n.t("validation.passwordFormat");
  return null;
}
export function validateFullName(v: string): string | null {
  if (!v.trim()) return i18n.t("validation.fullNameRequired");
  if (v.trim().length > 128) return i18n.t("validation.fullNameTooLong");
  if (v.trim().length < 2) return i18n.t("validation.fullNameTooShort");
  return null;
}
