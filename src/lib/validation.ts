// SRS AUTH-01: pwd 8+1upper+1num
export const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

/** The same rule as `passwordRegex`, one line per requirement, so the form can show them before the first error. */
export const PASSWORD_RULES: { id: string; label: string; test: (v: string) => boolean }[] = [
  { id: "length", label: "Có ít nhất 8 ký tự", test: (v) => v.length >= 8 },
  { id: "upper", label: "Có ít nhất 1 chữ hoa", test: (v) => /[A-Z]/.test(v) },
  { id: "digit", label: "Có ít nhất 1 chữ số", test: (v) => /\d/.test(v) },
];

export function validateEmail(v: string): string | null {
  if (!v.trim()) return "Email là bắt buộc";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Email không hợp lệ";
  if (v.length > 256) return "Email tối đa 256 ký tự";
  return null;
}
export function validatePassword(v: string): string | null {
  if (!v) return "Mật khẩu là bắt buộc";
  if (!passwordRegex.test(v)) return "Mật khẩu 8+ ký tự, 1 chữ hoa, 1 số";
  return null;
}
export function validateFullName(v: string): string | null {
  if (!v.trim()) return "Họ tên là bắt buộc";
  if (v.trim().length > 128) return "Tối đa 128 ký tự";
  if (v.trim().length < 2) return "Tối thiểu 2 ký tự";
  return null;
}
