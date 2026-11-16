import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PASSWORD_RULES } from "../../lib/validation";
import { Icon } from "./Icon";
import { cx } from "./controls";

/**
 * The sign-in screens are the form and nothing else: a split card with the form on the left and a
 * decorative navy panel on the right. No site header or footer, and a single brand mark as the way
 * back to the board. The panel is aria-hidden: it is marketing, not content.
 */
export function AuthLayout({
  title,
  lead,
  footer,
  children,
}: {
  title: ReactNode;
  lead?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <main className="jp-auth">
      <div className="jp-auth-card">
        <section className="jp-auth-form" aria-labelledby="auth-title">
          <Link to="/" className="jp-auth-mark" aria-label={t("nav.homeLabel")}>
            <b aria-hidden="true">jp</b>
            <span aria-hidden="true">jobplatform</span>
          </Link>

          <div className="jp-auth-heading">
            <h1 className="jp-auth-title" id="auth-title">
              {title}
            </h1>
            {lead && <p className="jp-auth-lead">{lead}</p>}
          </div>

          <div className="jp-auth-body">{children}</div>
          {footer && <p className="jp-auth-footer">{footer}</p>}
        </section>

        <aside className="jp-auth-visual" aria-hidden="true">
          <div className="jp-auth-visual-inner">
            <span className="jp-auth-eyebrow">{t("auth.layout.eyebrow")}</span>
            <p className="jp-auth-slogan">
              {t("auth.layout.sloganLead")} <em>{t("auth.layout.sloganAccent")}</em>
            </p>
            <p className="jp-auth-visual-lead">{t("auth.layout.lead")}</p>

            <ul className="jp-auth-points">
              <li>
                <Icon name="file" size={16} />
                {t("auth.layout.point1")}
              </li>
              <li>
                <Icon name="kanban" size={16} />
                {t("auth.layout.point2")}
              </li>
              <li>
                <Icon name="calendar" size={16} />
                {t("auth.layout.point3")}
              </li>
            </ul>

            <div className="jp-auth-board">
              <div className="jp-auth-board-head">
                <span>{t("auth.layout.boardTitle")}</span>
                <i />
              </div>
              <div className="jp-auth-board-row">
                <span className="jp-auth-board-dot is-amber" />
                <span>{t("auth.layout.boardRow1")}</span>
                <Icon name="chevronRight" size={14} />
              </div>
              <div className="jp-auth-board-row">
                <span className="jp-auth-board-dot is-navy" />
                <span>{t("auth.layout.boardRow2")}</span>
                <Icon name="chevronRight" size={14} />
              </div>
              <div className="jp-auth-board-row">
                <span className="jp-auth-board-dot is-success" />
                <span>{t("auth.layout.boardRow3")}</span>
                <Icon name="chevronRight" size={14} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/**
 * The password requirements, visible before the first keystroke and ticked as they are met. Each line
 * is a filled square with a check or an empty square, plus a word, so state never rests on colour alone.
 * Pass it as the Field `hint` so the rules are read out with the input.
 */
export function PasswordRules({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <>
      <span className="jp-rules-title">{t("auth.passwordRules.title")}</span>
      <ul className="jp-rules">
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(value);
          return (
            <li key={rule.id} className={cx("jp-rule", met && "is-met")}>
              <span className="jp-rule-box" aria-hidden="true">
                {met && <Icon name="check" size={12} />}
              </span>
              <span>{t(rule.labelKey)}</span>
              <span className="jp-sr">{met ? t("auth.passwordRules.met") : t("auth.passwordRules.unmet")}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
