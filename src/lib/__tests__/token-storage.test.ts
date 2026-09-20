import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from '../token-storage';

/**
 * tokenStorage tests.
 *
 * Verifies that the access token is stored/retrieved correctly from
 * sessionStorage, and that the refresh token is never accessible to JS
 * (it lives in an httpOnly cookie managed by the backend).
 *
 * DATABASE SAFETY: pure unit test, no network or database access.
 */
describe('tokenStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('getAccessToken', () => {
    it('returns null when no token has been stored', () => {
      expect(tokenStorage.getAccessToken()).toBeNull();
    });

    it('returns the stored access token', () => {
      tokenStorage.setAccessToken('test-access-token');
      expect(tokenStorage.getAccessToken()).toBe('test-access-token');
    });
  });

  describe('setAccessToken', () => {
    it('stores the access token in sessionStorage', () => {
      tokenStorage.setAccessToken('my-token');
      expect(tokenStorage.getAccessToken()).toBe('my-token');
    });

    it('overwrites a previously stored token', () => {
      tokenStorage.setAccessToken('first-token');
      tokenStorage.setAccessToken('second-token');
      expect(tokenStorage.getAccessToken()).toBe('second-token');
    });
  });

  describe('setTokens', () => {
    it('stores the access token (refresh token is ignored — lives in httpOnly cookie)', () => {
      tokenStorage.setTokens('access-123', 'refresh-ignored');
      expect(tokenStorage.getAccessToken()).toBe('access-123');
    });
  });

  describe('getRefreshToken', () => {
    it('always returns null — refresh token is in httpOnly cookie, not accessible to JS', () => {
      tokenStorage.setTokens('access', 'ignored-refresh');
      expect(tokenStorage.getRefreshToken()).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes the stored access token', () => {
      tokenStorage.setAccessToken('to-be-cleared');
      tokenStorage.clear();
      expect(tokenStorage.getAccessToken()).toBeNull();
    });

    it('is safe to call when no token is stored', () => {
      expect(() => tokenStorage.clear()).not.toThrow();
    });
  });
});
