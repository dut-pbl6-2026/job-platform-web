import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Icon, type IconName } from "./Icon";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* Buttons ---------------------------------------------------------------------------------------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonLook = { variant?: Variant; size?: Size; block?: boolean; icon?: IconName };

function buttonClass({ variant = "primary", size = "md", block }: ButtonLook, extra?: string) {
  return cx("jp-btn", `jp-btn--${variant}`, size !== "md" && `jp-btn--${size}`, block && "jp-btn--block", extra);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook & { loading?: boolean };

/** A button. While `loading` it is disabled and shows a spinner; pass the in-progress label as children. */
export function Button({ variant, size, block, icon, loading, className, children, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block }, className)}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

/** A router link that looks like a button (navigation, not an action). */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: LinkProps & ButtonLook) {
  return (
    <Link {...rest} className={buttonClass({ variant, size, block }, className)}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export function Spinner() {
  return <span className="jp-spinner" aria-hidden="true" />;
}

/** Marks a capability that exists in the UI but is not served yet (PRODUCT.md principle 3). */
export function DevTag() {
  return <span className="jp-devtag">đang phát triển</span>;
}

/* Form fields ------------------------------------------------------------------------------------ */

type FieldProps = {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactElement;
};

/**
 * A labelled control. The single child receives `id`, `aria-describedby` (hint, then error) and
 * `aria-invalid`, so the label, hint and error are announced with the control.
 */
export function Field({ id, label, hint, error, required, optional, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const child = Children.only(children);
  const control = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": required || undefined })
    : child;
  return (
    <div className={cx("jp-field", className)}>
      <label className="jp-label" htmlFor={id}>
        {label}
        {required && <span className="jp-req" aria-hidden="true"> *</span>}
        {optional && <span className="jp-optional"> (không bắt buộc)</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="jp-hint">{hint}</p>}
      {error && (
        <p id={errorId} className="jp-error" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx("jp-input", className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} {...rest} className={cx("jp-input jp-textarea", className)} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <span className={cx("jp-select", className)}>
      <select ref={ref} {...rest}>{children}</select>
      <Icon name="chevronDown" size={16} />
    </span>
  );
});

/** Password input with a show/hide toggle that keeps the field's own id and description. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function PasswordInput({ className, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <span className={cx("jp-password", className)}>
      <input ref={ref} {...rest} type={shown ? "text" : "password"} className="jp-input" />
      <button
        type="button"
        className="jp-password-toggle"
        aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={shown}
        onClick={() => setShown((v) => !v)}
      >
        <Icon name={shown ? "eyeOff" : "eye"} />
      </button>
    </span>
  );
});

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; count?: number };

export function Checkbox({ label, count, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx("jp-check", className)}>
      <input type="checkbox" {...rest} />
      <span className="jp-check-box" aria-hidden="true"><Icon name="check" size={14} /></span>
      <span className="jp-check-label">{label}</span>
      {count != null && <span className="jp-check-count">{count.toLocaleString("vi-VN")}</span>}
    </label>
  );
}

type ChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & { pressed: boolean; count?: number };

/** A toggle (aria-pressed). Pressed means "your selection", so it takes the amber fill. */
export function FilterChip({ pressed, count, className, children, ...rest }: ChipProps) {
  return (
    <button {...rest} type="button" aria-pressed={pressed} className={cx("jp-chip", className)}>
      <span>{children}</span>
      {count != null && <span className="jp-chip-count">{count.toLocaleString("vi-VN")}</span>}
    </button>
  );
}

/** "Remove this filter" chip: the label plus an × with an accessible name. */
export function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="jp-chip jp-chip--removable" onClick={onRemove} aria-label={`Bỏ lọc ${label}`}>
      <span>{label}</span>
      <Icon name="x" size={14} />
    </button>
  );
}
