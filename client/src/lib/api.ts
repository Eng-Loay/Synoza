import axios from 'axios';
import {
  clearAuthSession,
  getStoredToken,
  setAuthSession,
} from './authStorage';

const API_TIMEOUT_MS = 20_000;

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAuthToken(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = axios
    .post<{ token: string }>(
      '/api/auth/refresh',
      {},
      { headers: { Authorization: `Bearer ${token}` }, timeout: API_TIMEOUT_MS },
    )
    .then((res) => {
      const next = res.data.token;
      if (next) localStorage.setItem('synoza_token', next);
      return next ?? null;
    })
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const original = err.config as (typeof err.config & { _authRetry?: boolean }) | undefined;
    const url = String(original?.url || '');

    if (status !== 401 || !original || original._authRetry) {
      return Promise.reject(err);
    }

    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verify-otp') ||
      url.includes('/auth/refresh');

    if (isAuthRoute) {
      return Promise.reject(err);
    }

    original._authRetry = true;
    const newToken = await refreshAuthToken();
    if (newToken) {
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }

    clearAuthSession();

    if (!url.includes('/auth/me') && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }

    return Promise.reject(err);
  },
);

export default api;

export async function pingServer(): Promise<{ online: boolean; latencyMs: number }> {
  const attempt = async (): Promise<{ online: boolean; latencyMs: number }> => {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/ping', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!res.ok) return { online: false, latencyMs: -1 };
      return { online: true, latencyMs: Math.round(performance.now() - start) };
    } catch {
      return { online: false, latencyMs: -1 };
    } finally {
      clearTimeout(timer);
    }
  };

  const first = await attempt();
  if (first.online) return first;
  await new Promise((r) => setTimeout(r, 800));
  return attempt();
}
