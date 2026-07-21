const ACCESS_TOKEN_KEY = 'dsssms.accessToken';
const REFRESH_TOKEN_KEY = 'dsssms.refreshToken';

/**
 * NOTE on the storage tradeoff: the backend issues the refresh token in the
 * JSON response body (not an httpOnly cookie), so the frontend has to hold
 * onto it somewhere itself to survive a page reload. localStorage is the
 * simplest option and is what's implemented here; it's readable by any
 * script on the page (XSS risk) so if this ships to production, moving the
 * refresh token to an httpOnly cookie set by the backend is the natural
 * next hardening step (tracked for Stage 10).
 */
export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  setAccessToken(accessToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
