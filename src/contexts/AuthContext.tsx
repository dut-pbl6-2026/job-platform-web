import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchMe, getAccessToken, login as apiLogin, logoutApi, register as apiRegister, setTokens } from "../lib/api";

type User = { id: string; email: string; fullName: string; role: string; isActive: boolean };

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { email: string; password: string; fullName: string; role?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
    } catch {
      setUser(null);
      setTokens(null, null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    setTokens(res.accessToken, res.refreshToken);
    const me = await fetchMe();
    setUser(me);
  }, []);

  const register = useCallback(async (p: { email: string; password: string; fullName: string; role?: string }) => {
    const res = await apiRegister(p);
    setTokens(res.accessToken, res.refreshToken);
    const me = await fetchMe();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch { /* ignore */ }
    setTokens(null, null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, loading, isAuthenticated: !!user, login, register, logout, refreshUser
  }), [user, loading, login, register, logout, refreshUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
