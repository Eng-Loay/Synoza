import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import api from '../lib/api';
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'STUDENT' | 'ADMIN';
  university?: string;
  phone?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('synoza_user');
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function clearAuthStorage() {
  localStorage.removeItem('synoza_token');
  localStorage.removeItem('synoza_user');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser);
  const [token, setToken] = useState<string | null>(localStorage.getItem('synoza_token'));
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        if (res.data.user) {
          setUser(res.data.user);
          localStorage.setItem('synoza_user', JSON.stringify(res.data.user));
        } else {
          logout();
        }
      })
      .catch((err: unknown) => {
        // Keep the session when the server is temporarily unreachable.
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('synoza_token', res.data.token);
      localStorage.setItem('synoza_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err: unknown) {
      if (!axios.isAxiosError(err) || !err.response) {
        throw new Error('SERVER_OFFLINE');
      }
      throw err;
    }
  };

  const register = async (data: Record<string, string>) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('synoza_token', res.data.token);
    localStorage.setItem('synoza_user', JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const updateUser = (updated: User) => {
    setUser(updated);
    localStorage.setItem('synoza_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
