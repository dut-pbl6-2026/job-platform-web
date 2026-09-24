import { Link } from "react-router-dom";
import { useToasts } from "../contexts/ToastContext";

export function ToastViewport() {
  const { toasts, dismiss, pause, resume } = useToasts();
  if (toasts.length === 0) {
    return <div className="toast-viewport" aria-live="polite" aria-relevant="additions" />;
  }

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`toast toast-${toast.kind}`}
          role="status"
          onMouseEnter={() => pause(toast.id)}
          onMouseLeave={() => resume(toast.id)}
          onFocus={() => pause(toast.id)}
          onBlur={() => resume(toast.id)}
        >
          <span className="toast-mark" aria-hidden="true">{toast.kind === "job" ? "JP" : "!"}</span>
          <div className="toast-copy">
            <p className="toast-title">{toast.title}</p>
            {toast.body ? <p className="toast-body">{toast.body}</p> : null}
            {toast.href ? (
              <Link className="toast-link" to={toast.href} onClick={() => dismiss(toast.id)}>
                Xem chi tiết
              </Link>
            ) : null}
          </div>
          <button type="button" className="toast-close" aria-label="Đóng thông báo" onClick={() => dismiss(toast.id)}>
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
