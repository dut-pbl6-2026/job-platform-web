import { useLocation } from "react-router-dom";
import { nextQuery, resolveAfterAuth } from "../lib/redirect";

/** After-auth destination plus the query string that keeps it when hopping between login and register. */
export function useAuthRedirect() {
  const { search, state } = useLocation();
  const target = resolveAfterAuth(search, state);
  return { target, query: nextQuery(target) };
}
