import type { ToastInput } from "../types/notification";

export const TOAST_EVENT = "jp:toast";

export function showToast(input: ToastInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastInput>(TOAST_EVENT, { detail: input }));
}
