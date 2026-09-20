import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from '../validation/auth.validation';

/**
 * Auth validation schema tests.
 *
 * Verifies that Zod schemas accept valid input and reject invalid input
 * with appropriate error messages. These schemas gate every auth endpoint.
 *
 * DATABASE SAFETY: pure unit test — Zod only, no database, no network.
 */

describe('loginSchema', () => {
  it('accepts a valid username and password', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: 'anypassword' });
    expect(result.success).toBe(true);
  });

  it('rejects missing username', () => {
    const result = loginSchema.safeParse({ password: 'pw' });
    expect(result.success).toBe(false);
  });

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ username: '', password: 'pw' });
    expect(result.success).toBe(false);
  });

  it('rejects missing password', () => {
    const result = loginSchema.safeParse({ username: 'admin' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ username: 'admin', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a username longer than 50 characters', () => {
    const result = loginSchema.safeParse({ username: 'a'.repeat(51), password: 'pw' });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  const validInput = {
    currentPassword:    'OldPass1!',
    newPassword:        'NewPass1!',
    confirmNewPassword: 'NewPass1!',
  };

  it('accepts a valid change-password payload', () => {
    expect(changePasswordSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejects when newPassword and confirmNewPassword do not match', () => {
    const result = changePasswordSchema.safeParse({
      ...validInput,
      confirmNewPassword: 'DifferentPass1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmNewPassword');
    }
  });

  it('rejects when new password is same as current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword:    'SamePass1!',
      newPassword:        'SamePass1!',
      confirmNewPassword: 'SamePass1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('newPassword');
    }
  });

  it('rejects new password shorter than 8 characters', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword:    'OldPass1!',
      newPassword:        'Ab1!',
      confirmNewPassword: 'Ab1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password missing an uppercase letter', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword:    'OldPass1!',
      newPassword:        'nouppercase1!',
      confirmNewPassword: 'nouppercase1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password missing a digit', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword:    'OldPass1!',
      newPassword:        'NoDigitHere!',
      confirmNewPassword: 'NoDigitHere!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects new password missing a special character', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword:    'OldPass1!',
      newPassword:        'NoSpecial1A',
      confirmNewPassword: 'NoSpecial1A',
    });
    expect(result.success).toBe(false);
  });
});

describe('refreshTokenSchema', () => {
  it('accepts a payload with a refresh token (legacy body-based flow)', () => {
    const result = refreshTokenSchema.safeParse({ refreshToken: 'some.jwt.token' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty body (cookie-based flow — no refreshToken in body)', () => {
    const result = refreshTokenSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
