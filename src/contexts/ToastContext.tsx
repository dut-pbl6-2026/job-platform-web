import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { jobToastPollMs, TOAST_DISMISS_MS, TOAST_STACK_LIMIT } from "../lib/config";
import { fetchJobs } from "../lib/jobsApi";
import { toastFromJob, toastFromSocketMessage } from "../lib/notificationMessages";
import { connectNotificationSocket } from "../lib/notificationSocket";
import { getAccessToken } from "../lib/api";
import { showToast, TOAST_EVENT } from "../lib/toastBus";
import type { ToastInput, ToastItem } from "../types/notification";
import { useAuth } from "./AuthContext";

type ToastState = {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
};

const Ctx = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const userId = user?.id;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenRef = useRef(new Set<string>());
  const orderRef = useRef<string[]>([]);
  const timersRef = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const arm = useCallback((id: string) => {
    const previous = timersRef.current.get(id);
    if (previous) window.clearTimeout(previous);
    timersRef.current.set(id, window.setTimeout(() => dismiss(id), TOAST_DISMISS_MS));
  }, [dismiss]);

  const remember = useCallback((key: string) => {
    if (seenRef.current.has(key)) return false;
    seenRef.current.add(key);
    orderRef.current.push(key);
    if (orderRef.current.length > 200) {
      const oldest = orderRef.current.shift();
      if (oldest) seenRef.current.delete(oldest);
    }
    return true;
  }, []);

  const push = useCallback((input: ToastInput) => {
    const key = input.dedupeKey || input.id;
    if (key && !remember(key)) return;
    const id = input.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `toast-${Date.now()}`);
    const item: ToastItem = {
      id,
      kind: input.kind ?? "info",
      title: input.title,
      body: input.body,
      href: input.href,
    };
    setToasts((list) => [item, ...list.filter((toast) => toast.id !== id)].slice(0, TOAST_STACK_LIMIT));
    arm(id);
  }, [arm, remember]);

  const pause = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastInput>).detail;
      if (!detail?.title?.trim()) return;
      push(detail);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, [push]);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    if (!getAccessToken()) return;

    let stopped = false;
    let primed = false;
    const knownJobs = new Set<string>();

    const stopSocket = connectNotificationSocket(getAccessToken, (raw) => {
      const toast = toastFromSocketMessage(raw);
      if (toast) showToast(toast);
    });

    const poll = async () => {
      if (stopped || document.hidden) return;
      try {
        const page = await fetchJobs({ page: 0, size: 20 });
        const items = page.items ?? [];
        if (!primed) {
          for (const job of items) {
            if (!job?.id) continue;
            knownJobs.add(job.id);
            remember(`job:${job.id}`);
          }
          primed = true;
          return;
        }
        const fresh = items.filter((job) => job?.id && !knownJobs.has(job.id));
        for (const job of fresh) knownJobs.add(job.id);
        for (const job of fresh.slice(0, 3)) showToast(toastFromJob(job));
        if (fresh.length > 3) {
          showToast({
            dedupeKey: `job-batch:${fresh.map((job) => job.id).sort().join(",")}`,
            kind: "job",
            title: `Có thêm ${fresh.length - 3} việc làm mới`,
            href: "/jobs",
          });
        }
      } catch {
        /* search/gateway down — socket remains the realtime path */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), jobToastPollMs());
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      stopSocket();
    };
  }, [isAuthenticated, remember, userId]);

  useEffect(() => {
    if (isAuthenticated) return;
    setToasts([]);
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, [isAuthenticated]);

  const value = useMemo(() => ({ toasts, dismiss, pause, resume: arm }), [toasts, dismiss, pause, arm]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useToasts() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useToasts must be inside ToastProvider");
  return value;
}
