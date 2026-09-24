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

function isServerPing(data: string) {
  if (!data.includes("ping")) return false;
  try {
    const msg = JSON.parse(data) as { type?: unknown; messageType?: unknown };
    return msg?.type === "ping" || msg?.messageType === "ping";
  } catch {
    return false;
  }
}

/**
 * WS-01-01 / WS-01-06: authenticated socket with ping and exponential reconnect.
 * Returns a stop function. Connection failures stay silent so a missing gateway
 * does not cover the page in error toasts.
 * `getToken` is read on every attempt: access tokens expire after 60m and are rotated by the refresh interceptor.
 */
export function connectNotificationSocket(getToken: () => string | null, onMessage: (data: string) => void): () => void {
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
    const token = getToken();
    if (!token) {
      schedule();
      return;
    }
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
      if (typeof event.data !== "string") return;
      if (isServerPing(event.data)) {
        if (next.readyState === WebSocket.OPEN) next.send(JSON.stringify({ type: "pong" }));
        return;
      }
      onMessage(event.data);
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
