import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../lib/auth-api';
import { tokenStorage } from '../lib/token-storage';
import { SESSION_EXPIRED_EVENT } from '../lib/api-client';
import type { AuthenticatedUser } from '../types/auth';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On first load, if we already hold an access token, try to hydrate the
  // session by asking who it belongs to (the api client will transparently
  // refresh it if it's expired but the refresh token is still valid).
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) setUser(me);
      } catch {
        tokenStorage.clear();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // If a background token refresh ever fails (refresh token expired/revoked),
  // drop the session everywhere the app is listening for it.
  useEffect(() => {
    const handleSessionExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    setUser(null);
    if (refreshToken) {
      // Best-effort — the session is already cleared client-side regardless of outcome.
      await authApi.logout(refreshToken).catch(() => undefined);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
