/**
 * Access token storage — stored in memory (sessionStorage for tab persistence).
 *
 * Security model:
 * - Refresh token: stored in an httpOnly cookie set by the backend.
 *   JS never sees it. The browser sends it automatically on /auth/refresh
 *   and /auth/logout requests.
 * - Access token: short-lived (15 min), stored in sessionStorage.
 *   sessionStorage is cleared when the tab closes and is not accessible
 *   to other tabs, reducing the XSS blast radius compared to localStorage.
 */
const ACCESS_TOKEN_KEY = 'dsssms.accessToken';

export const tokenStorage = {
  getAccessToken(): string | null {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /** Called after a successful login — only stores the access token. */
  setTokens(accessToken: string, _refreshToken?: string): void {
    // _refreshToken ignored — it now lives in an httpOnly cookie managed by the backend.
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  setAccessToken(accessToken: string): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },

  /** @deprecated Refresh token is now in a cookie — always returns null. */
  getRefreshToken(): string | null {
    return null;
  },

  clear(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    // The refresh cookie is cleared by the backend on /auth/logout.
  },
};
