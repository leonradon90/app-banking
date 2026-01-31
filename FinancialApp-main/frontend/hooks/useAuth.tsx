import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, refreshSession } from '../lib/api';
import { AuthSession, getStoredAuth, onAuthUpdate, setStoredAuth } from '../lib/auth';

type AuthContextValue = {
  session: AuthSession | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setSession(getStoredAuth());
    setIsReady(true);
    const unsubscribe = onAuthUpdate(() => setSession(getStoredAuth()));
    return () => {
      unsubscribe?.();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const payload = await apiRequest<AuthSession>({
      path: '/auth/login',
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setStoredAuth(payload);
    setSession(payload);
  };

  const register = async (email: string, password: string) => {
    const payload = await apiRequest<AuthSession>({
      path: '/auth/register',
      method: 'POST',
      body: { email, password },
      skipAuth: true,
    });
    setStoredAuth(payload);
    setSession(payload);
  };

  const refresh = async () => {
    const updated = await refreshSession();
    if (updated) {
      setSession(updated);
    }
  };

  const logout = () => {
    setStoredAuth(null);
    setSession(null);
  };

  const value = useMemo(
    () => ({
      session,
      isReady,
      login,
      register,
      logout,
      refresh,
    }),
    [session, isReady]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
