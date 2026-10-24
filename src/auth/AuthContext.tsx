import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UNAUTHORIZED_EVENT, fetchSession, logoutRequest } from '../api';
import type { Role } from '../domain/types';
import { API_MODE } from '../env';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
}

interface AuthValue {
  user: SessionUser | null;
  /** false khi đang hỏi máy chủ phiên còn hiệu lực không (chỉ ở chế độ backend thật) */
  ready: boolean;
  login: (user: SessionUser) => void;
  logout: () => void;
}

const KEY = 'we.session';
const AuthContext = createContext<AuthValue | null>(null);

function load(): SessionUser | null {
  // Bản thật: phiên nằm ở cookie HttpOnly, nguồn đúng duy nhất là máy chủ (hỏi lại khi mở trang)
  if (API_MODE === 'real') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function remember(u: SessionUser | null) {
  if (API_MODE === 'real') return;
  try {
    if (u) localStorage.setItem(KEY, JSON.stringify(u));
    else localStorage.removeItem(KEY);
  } catch {
    /* chế độ riêng tư: bỏ qua, phiên chỉ sống trong tab */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(load);
  const [ready, setReady] = useState(API_MODE !== 'real');

  useEffect(() => {
    if (API_MODE !== 'real') return;
    let alive = true;
    fetchSession()
      .then((u) => alive && setUser(u))
      .catch(() => alive && setUser(null))
      .finally(() => alive && setReady(true));
    const onExpired = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
    };
  }, []);

  const login = useCallback((u: SessionUser) => {
    setUser(u);
    remember(u);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    remember(null);
    void logoutRequest();
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}

export function useUser(): SessionUser {
  const { user } = useAuth();
  if (!user) throw new Error('Chưa đăng nhập');
  return user;
}
