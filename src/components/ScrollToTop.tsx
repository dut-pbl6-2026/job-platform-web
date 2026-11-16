import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * A new page starts at the top. Without this the browser keeps the previous scroll position, so a
 * footer link opens the next page with its footer in view. Back/forward are left alone: the browser
 * restores the position the visitor came from.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger; the effect only touches window.
  useEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
}
