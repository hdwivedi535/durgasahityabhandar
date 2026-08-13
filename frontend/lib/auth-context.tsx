'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '@dsb/shared';
import { apiFetch, apiFetchWithToken } from '@/lib/api-client';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'dsb_access_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const persistToken = (token: string | null) => {
    setAccessToken(token);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  };

  const loadMe = useCallback(async (token: string) => {
    const data = await apiFetchWithToken<{ user: AuthUser }>('/auth/me', token);
    setUser(data.user);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: AuthUser; accessToken: string }>('/auth/refresh', {
        method: 'POST',
      });
      persistToken(data.accessToken);
      setUser(data.user);
    } catch {
      persistToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    async function init() {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          await loadMe(stored);
          persistToken(stored);
        } catch {
          await refresh();
        }
      } else {
        await refresh();
      }
      setLoading(false);
    }
    init();
  }, [loadMe, refresh]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthUser; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persistToken(data.accessToken);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      if (accessToken) {
        await apiFetchWithToken('/auth/logout', accessToken, { method: 'POST' });
      }
    } finally {
      persistToken(null);
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, accessToken, loading, login, logout, refresh }),
    [user, accessToken, loading, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
