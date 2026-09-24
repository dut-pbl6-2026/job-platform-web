export type ToastKind = "job" | "info" | "success" | "warning" | "error";

export type ToastInput = {
  id?: string;
  /** Suppress repeat toasts for the same job or notification. */
  dedupeKey?: string;
  kind?: ToastKind;
  title: string;
  body?: string;
  href?: string;
};

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  href?: string;
};

/** SRS 4.9.4 server → client notification payload. */
export type IncomingNotification = {
  id?: string;
  type?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
};
