import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { cx } from "./controls";

/* Alerts ----------------------------------------------------------------------------------------- */

type Tone = "error" | "success" | "info" | "warning";

const ALERT_ICON: Record<Tone, IconName> = { error: "alert", success: "checkCircle", info: "info", warning: "alert" };

/**
 * A message with icon + text (never color alone). Errors use role="alert" so screen readers read
 * them as they appear; the rest are polite status messages.
 */
export function Alert({ tone = "error", title, children, action, className }: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("jp-alert", `jp-alert--${tone}`, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon name={ALERT_ICON[tone]} />
      <div className="jp-alert-body">
        {title && <p className="jp-alert-title">{title}</p>}
        {children && <div className="jp-alert-text">{children}</div>}
      </div>
      {action && <div className="jp-alert-action">{action}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="jp-empty">
      <h2 className="jp-empty-title">{title}</h2>
      {children && <div className="jp-empty-text">{children}</div>}
      {action && <div className="jp-empty-action">{action}</div>}
    </div>
  );
}

/* Loading ---------------------------------------------------------------------------------------- */

/** Placeholder rows with the same height as real board rows, so nothing jumps when data arrives. */
export function SkeletonRows({ rows = 6, label = "Đang tải" }: { rows?: number; label?: string }) {
  return (
    <div className="jp-skeleton-rows" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="jp-skeleton-row" aria-hidden="true">
          <span className="jp-skeleton-bar jp-skeleton-bar--title" />
          <span className="jp-skeleton-bar" />
          <span className="jp-skeleton-bar" />
          <span className="jp-skeleton-bar jp-skeleton-bar--short" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 240, label = "Đang tải" }: { height?: number; label?: string }) {
  return <div className="jp-skeleton-block" style={{ height }} role="status" aria-label={label} />;
}

/* Status ----------------------------------------------------------------------------------------- */

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Shape + word. The shape differs per tone, so the status survives grayscale and color blindness. */
export function StatusMark({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={`jp-status jp-status--${tone}`}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        {tone === "success" && <circle cx="6" cy="6" r="5" fill="currentColor" />}
        {tone === "warning" && (
          <>
            <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 1.75a4.25 4.25 0 0 1 0 8.5z" fill="currentColor" />
          </>
        )}
        {tone === "danger" && <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        {tone === "info" && <rect x="1.5" y="1.5" width="9" height="9" rx="1" transform="rotate(45 6 6)" fill="currentColor" />}
        {tone === "neutral" && <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      {children}
    </span>
  );
}

/** "Mới": a red square plus the word, for jobs posted in the last 24 hours. */
export function NewMark() {
  return <span className="jp-new">Mới</span>;
}

/* Navigation ------------------------------------------------------------------------------------- */

type PageItem = number | "gap";

function pageItems(page: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const items: PageItem[] = [0];
  const from = Math.max(1, Math.min(page - 1, total - 4));
  const to = Math.min(total - 2, Math.max(page + 1, 3));
  if (from > 1) items.push("gap");
  for (let p = from; p <= to; p++) items.push(p);
  if (to < total - 2) items.push("gap");
  items.push(total - 1);
  return items;
}

/** The one pager. `page` is 0-based; labels are 1-based. */
export function Pagination({ page, totalPages, onPage, label = "Phân trang" }: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="jp-pager" aria-label={label}>
      <button type="button" className="jp-pager-step" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        <Icon name="chevronLeft" size={16} />
        Trước
      </button>
      <ol className="jp-pager-list">
        {pageItems(page, totalPages).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} className="jp-pager-gap" aria-hidden="true">…</li>
          ) : (
            <li key={item}>
              <button
                type="button"
                className="jp-pager-num"
                aria-current={item === page ? "page" : undefined}
                aria-label={`Trang ${item + 1}`}
                onClick={() => onPage(item)}
              >
                {item + 1}
              </button>
            </li>
          ),
        )}
      </ol>
      <button type="button" className="jp-pager-step" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>
        Sau
        <Icon name="chevronRight" size={16} />
      </button>
    </nav>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="jp-back">
      <Icon name="arrowLeft" size={16} />
      {children}
    </Link>
  );
}

/** Page title block: optional back link, h1, one line of lead text, optional actions on the right. */
export function PageHead({ title, lead, back, actions }: { title: ReactNode; lead?: ReactNode; back?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="jp-pagehead">
      {back}
      <div className="jp-pagehead-row">
        <div>
          <h1 className="jp-h1">{title}</h1>
          {lead && <p className="jp-lead">{lead}</p>}
        </div>
        {actions && <div className="jp-pagehead-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, className, as: Tag = "section" }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "aside" | "article";
}) {
  return (
    <Tag className={cx("jp-panel", className)}>
      {(title || actions) && (
        <div className="jp-panel-head">
          {title && <h2 className="jp-h2">{title}</h2>}
          {actions && <div className="jp-panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** What a route guard shows while it waits to learn who is signed in. */
export function PageLoading({ label = "Đang tải" }: { label?: string }) {
  return (
    <main className="jp-page">
      <SkeletonBlock height={240} label={label} />
    </main>
  );
}
