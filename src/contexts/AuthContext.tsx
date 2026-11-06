import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchMe, forgotPassword as apiForgot, getAccessToken, login as apiLogin, logoutApi, register as apiRegister, resetPassword as apiReset, setTokens, subscribeTokenChanges } from "../lib/api";

type User = { id: string; email: string; fullName: string; role: string; isActive: boolean };

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (p: { email: string; password: string; fullName: string; role?: string; companyId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string) => Promise<string>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setUser(null); setLoading(false); return; }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch (e) {
      setUser(null);
      // The interceptor already ends the session when the refresh token is rejected.
      // A network error or 5xx (backend restarting) must not log the user out.
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) setTokens(null, null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Keep tabs in sync: logout in one tab logs out the others, login in one tab logs in the others.
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => subscribeTokenChanges((loggedIn) => {
    if (!loggedIn) setUser(null);
    else if (!userRef.current) void refreshUser();
  }), [refreshUser]);

  const login = useCallback(async (email: string, password: string, rememberMe = false) => {
    const res = await apiLogin({ email, password, rememberMe });
    setTokens(res.accessToken, res.refreshToken);
    const me = await fetchMe();
    setUser(me);
  }, []);

  // Best practice 2026: register 201 userId then explicit login (avoids contract drift)
  const register = useCallback(async (p: { email: string; password: string; fullName: string; role?: string; companyId?: string }) => {
    await apiRegister(p);
    const res = await apiLogin({ email: p.email, password: p.password });
    setTokens(res.accessToken, res.refreshToken);
    const me = await fetchMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* ignore */ }
    setTokens(null, null);
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const res = await apiForgot(email);
    return res.message;
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    const res = await apiReset({ token, newPassword });
    return res.message;
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, isAuthenticated: !!user, login, register, logout, refreshUser, forgotPassword, resetPassword
  }), [user, loading, login, register, logout, refreshUser, forgotPassword, resetPassword]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
