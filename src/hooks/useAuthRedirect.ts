import { useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { defaultAfterAuth, explicitAfterAuth, nextQuery, resolveAfterAuth } from "../lib/redirect";

/** After-auth destination plus the query string that keeps it when hopping between login and register. */
export function useAuthRedirect() {
  const { search, state } = useLocation();
  const { user } = useAuth();
  const explicit = explicitAfterAuth(search, state);
  const target = resolveAfterAuth(search, state, defaultAfterAuth(user?.role));
  // Keep an explicit target in the URL only; the role default needs no ?next=.
  return { target, query: explicit ? nextQuery(explicit) : "" };
}
