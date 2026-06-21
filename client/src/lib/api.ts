import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('synoza_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const url = String(err.config?.url || '');
      const isLoginRequest = url.includes('/auth/login') || url.includes('/auth/register');

      if (!isLoginRequest) {
        localStorage.removeItem('synoza_token');
        localStorage.removeItem('synoza_user');

        // Let AuthContext handle invalid sessions during bootstrap.
        if (!url.includes('/auth/me') && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
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
