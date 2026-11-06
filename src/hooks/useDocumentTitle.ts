import { useEffect } from "react";

export const APP_NAME = "Vietnam Job Platform";

/** Sets the browser tab title to "<title> — Vietnam Job Platform". Pass undefined to leave it unchanged. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} — ${APP_NAME}`;
  }, [title]);
}
