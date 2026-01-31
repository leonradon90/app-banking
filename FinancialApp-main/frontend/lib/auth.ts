export type AuthUser = {
  id: number;
  email: string;
  kycStatus: string;
  roles: string[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

const STORAGE_KEY = 'altx.auth.session';
const AUTH_EVENT = 'altx.auth.updated';

export const getStoredAuth = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const setStoredAuth = (session: AuthSession | null) => {
  if (typeof window === 'undefined') return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
};

export const onAuthUpdate = (handler: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
};
