import type { ReactNode } from "react";
import { PASSWORD_RULES } from "../../lib/validation";
import { Icon } from "./Icon";
import { TopBar } from "./TopBar";
import { cx } from "./controls";

/**
 * The four sign-in screens share this: the navy shell bar (so there is always a way back to the
 * board), then one plain panel on the ground colour. No gradient, no brand claims.
 */
export function AuthLayout({ title, lead, footer, children }: {
  title: ReactNode;
  lead?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar />
      <main className="jp-auth">
        <div className="jp-panel jp-auth-panel">
          <h1 className="jp-h1">{title}</h1>
          {lead && <p className="jp-lead">{lead}</p>}
          <div className="jp-auth-body">{children}</div>
          {footer && <p className="jp-auth-footer">{footer}</p>}
        </div>
      </main>
    </>
  );
}

/**
 * The password requirements, visible before the first keystroke and ticked as they are met. Each line
 * is a filled square with a check or an empty square, plus a word, so state never rests on colour alone.
 * Pass it as the Field `hint` so the rules are read out with the input.
 */
export function PasswordRules({ value }: { value: string }) {
  return (
    <>
      <span className="jp-rules-title">Mật khẩu cần:</span>
      <ul className="jp-rules">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className={cx("jp-rule", met && "is-met")}>
              <span className="jp-rule-box" aria-hidden="true">{met && <Icon name="check" size={12} />}</span>
              <span>{rule.label}</span>
              <span className="jp-sr">{met ? " (đã đạt)" : " (chưa đạt)"}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
