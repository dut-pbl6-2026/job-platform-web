import { API_BASE_URL, NOTIFICATION_WS_PATH, WS_PING_MS } from "./config";

/** Browser WebSocket cannot set Authorization; SRS requires the JWT on the connection string. */
export function resolveNotificationsWsUrl(token: string): string {
  const query = `token=${encodeURIComponent(token)}`;
  if (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")) {
    const api = new URL(API_BASE_URL);
    const protocol = api.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${api.host}${NOTIFICATION_WS_PATH}?${query}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${NOTIFICATION_WS_PATH}?${query}`;
}

/**
 * WS-01-01 / WS-01-06: authenticated socket with ping and exponential reconnect.
 * Returns a stop function. Connection failures stay silent so a missing gateway
 * does not cover the page in error toasts.
 */
export function connectNotificationSocket(token: string, onMessage: (data: string) => void): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;
  let pingTimer = 0;
  let retryTimer = 0;
  let settled = false;

  const clearPing = () => {
    if (pingTimer) window.clearInterval(pingTimer);
    pingTimer = 0;
  };

  const schedule = () => {
    if (stopped) return;
    const delay = Math.min(30_000, 1000 * 2 ** attempt);
    attempt += 1;
    retryTimer = window.setTimeout(connect, delay);
  };

  const connect = () => {
    if (stopped) return;
    settled = false;
    let next: WebSocket;
    try {
      next = new WebSocket(resolveNotificationsWsUrl(token));
    } catch {
      schedule();
      return;
    }
    socket = next;

    next.onopen = () => {
      attempt = 0;
      clearPing();
      pingTimer = window.setInterval(() => {
        if (next.readyState === WebSocket.OPEN) next.send(JSON.stringify({ type: "ping" }));
      }, WS_PING_MS);
    };

    next.onmessage = (event) => {
      if (typeof event.data === "string") onMessage(event.data);
    };

    const fail = () => {
      if (settled || stopped) return;
      settled = true;
      clearPing();
      schedule();
    };

    next.onerror = () => {
      if (next.readyState !== WebSocket.CLOSED) next.close();
    };
    next.onclose = fail;
  };

  connect();

  return () => {
    stopped = true;
    settled = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    clearPing();
    socket?.close();
  };
}
