import { describe, it, expect, vi } from 'vitest';

/**
 * JWT utility tests.
 *
 * Tests sign/verify round-trip behavior for access and refresh tokens.
 * The env module is mocked with test secrets so these tests never read
 * real production secrets from the environment.
 *
 * DATABASE SAFETY: pure unit test — no database, no network.
 */

vi.mock('../../../config/env', () => ({
  env: {
    JWT_ACCESS_SECRET:      'test-access-secret-min-32-chars-padded',
    JWT_ACCESS_EXPIRES_IN:  '15m',
    JWT_REFRESH_SECRET:     'test-refresh-secret-min-32-chars-padded',
    JWT_REFRESH_EXPIRES_IN: '7d',
  },
  isProduction:  false,
  isDevelopment: true,
  isTest:        true,
}));

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../jwt.util';

describe('Access token', () => {
  const payload = { sub: 42, role: 'TEACHER' as const, username: 'teacher1' };

  it('sign + verify round-trip returns the original payload fields', () => {
    const token   = signAccessToken(payload);
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(42);
    expect(decoded.role).toBe('TEACHER');
    expect(decoded.username).toBe('teacher1');
  });

  it('produces a non-empty JWT string', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('throws when verified with the wrong secret', () => {
    const token = signAccessToken(payload);
    // tamper: flip one char in the signature segment
    const parts = token.split('.');
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('a') ? 'b' : 'a');
    expect(() => verifyAccessToken(parts.join('.'))).toThrow();
  });

  it('does not accept a refresh token as an access token', () => {
    const refreshToken = signRefreshToken({ sub: 1, jti: 'uuid-1' });
    // verifyAccessToken uses a different secret — should throw
    expect(() => verifyAccessToken(refreshToken)).toThrow();
  });
});

describe('Refresh token', () => {
  const payload = { sub: 7, jti: 'test-jti-uuid' };

  it('sign + verify round-trip returns the original payload fields', () => {
    const token   = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);

    expect(decoded.sub).toBe(7);
    expect(decoded.jti).toBe('test-jti-uuid');
  });

  it('produces a non-empty JWT string', () => {
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('throws on a completely invalid token string', () => {
    expect(() => verifyRefreshToken('not.a.token')).toThrow();
  });

  it('does not accept an access token as a refresh token', () => {
    const accessToken = signAccessToken({ sub: 1, role: 'ADMIN' as const, username: 'a' });
    // verifyRefreshToken uses a different secret — should throw
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
