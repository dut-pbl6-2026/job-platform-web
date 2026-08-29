import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// Fetch-like wrapper with auto JWT attach + refresh retry
let accessToken: string | null = localStorage.getItem("accessToken");
let refreshToken: string | null = localStorage.getItem("refreshToken");

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem("accessToken", access);
  else localStorage.removeItem("accessToken");
  if (refresh) localStorage.setItem("refreshToken", refresh);
  else localStorage.removeItem("refreshToken");
}

export function getAccessToken() {
  return accessToken;
}
export function getRefreshToken() {
  return refreshToken;
}

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing = false;
let queue: Array<(t: string | null) => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && refreshToken) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push((t) => {
            if (t) {
              original.headers.Authorization = `Bearer ${t}`;
              original._retry = true;
              resolve(api(original));
            } else reject(error);
          });
        });
      }
      refreshing = true;
      try {
        const res = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_BASE}/auth/refresh`,
          { refreshToken }
        );
        const { accessToken: newAccess, refreshToken: newRefresh } = res.data;
        setTokens(newAccess, newRefresh);
        queue.forEach((cb) => cb(newAccess));
        queue = [];
        original.headers.Authorization = `Bearer ${newAccess}`;
        original._retry = true;
        return api(original);
      } catch (e) {
        queue.forEach((cb) => cb(null));
        queue = [];
        setTokens(null, null);
        throw e;
      } finally {
        refreshing = false;
      }
    }
    throw error;
  }
);

// Typed helpers
export async function register(payload: { email: string; password: string; fullName: string; role?: string }) {
  const { data } = await api.post("/auth/register", payload);
  return data as { accessToken: string; refreshToken: string; userId: string; email: string; fullName: string; role: string };
}
export async function login(payload: { email: string; password: string }) {
  const { data } = await api.post("/auth/login", payload);
  return data as { accessToken: string; refreshToken: string; userId: string; email: string; fullName: string; role: string };
}
export async function fetchMe() {
  const { data } = await api.get("/auth/me");
  return data as { id: string; email: string; fullName: string; role: string; isActive: boolean };
}
export async function logoutApi() {
  const rt = getRefreshToken();
  if (!rt) return;
  await api.post("/auth/logout", { refreshToken: rt });
}
