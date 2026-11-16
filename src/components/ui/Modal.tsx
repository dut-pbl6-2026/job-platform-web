import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./controls";
import { Icon } from "./Icon";

/**
 * Native <dialog> in modal mode: focus is trapped, Esc closes, and the browser paints the backdrop.
 * The card stays mounted while closed so a form keeps its state between openings.
 */
export function Modal({
  open,
  title,
  lead,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  lead?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cx("jp-modal", `is-${size}`)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop targets the dialog element itself, never the card.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="jp-modal-card">
        <header className="jp-modal-head">
          <div>
            <h2 className="jp-modal-title" id={titleId}>
              {title}
            </h2>
            {lead && <p className="jp-modal-lead">{lead}</p>}
          </div>
          <button type="button" className="jp-icon-btn" aria-label="Đóng" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </header>
        <div className="jp-modal-body">{children}</div>
        {footer && <footer className="jp-modal-foot">{footer}</footer>}
      </div>
    </dialog>
  );
}
