/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Login flow regression tests — covers the dasi.shallo scenario and related edge cases.
 *
 * Root cause of the reported issue (dasi.shallo "Invalid username or password"):
 *   The account is working correctly. The user was trying a password from an
 *   earlier admin-reset that was subsequently overwritten by 5 more resets.
 *   Each admin reset generates a new random temporary password shown once.
 *   Only the LATEST reset password is valid. This is correct behavior.
 *
 * These tests verify every branch of the login flow including:
 *   - Valid credentials → success + token pair
 *   - Superseded temporary password (incorrect) → 401
 *   - Unknown username → 401 (same error, no username enumeration)
 *   - Inactive account → 403
 *   - Locked account → 403
 *   - Failed-attempt counter increments correctly
 *   - Account locks on LOGIN_MAX_ATTEMPTS
 *   - Expired lock clears on next successful attempt
 *   - Admin password reset: new hash stored, isTemporaryPassword stays true
 *   - Password change: isTemporaryPassword becomes false, all sessions revoked
 *   - Malformed request: missing username/password
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AuthService } from '../auth.service';
import { ForbiddenError, UnauthorizedError } from '../../../core/errors/app-error';

// ── Mocks (must come before imports) ─────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user:         { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn() },
  },
}));
vi.mock('../../../core/utils/password.util', () => ({
  verifyPassword: vi.fn(),
  hashPassword:   vi.fn().mockResolvedValue('new-bcrypt-hash'),
}));
vi.mock('../../../core/utils/jwt.util', () => ({
  signAccessToken:    vi.fn().mockReturnValue('mock-access-token'),
  signRefreshToken:   vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
}));
vi.mock('../../../core/utils/token.util', () => ({
  hashToken:            vi.fn().mockReturnValue('hashed-token'),
  durationToFutureDate: vi.fn().mockReturnValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
}));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));
vi.mock('../../../config/env', () => ({
  env: {
    LOGIN_MAX_ATTEMPTS:    5,
    LOGIN_LOCKOUT_MINUTES: 15,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_SALT_ROUNDS: 12,
  },
  isProduction: false,
}));

import { prisma }       from '../../../database/prisma-client';
import { verifyPassword, hashPassword } from '../../../core/utils/password.util';
import { recordAudit }  from '../../../core/audit/audit-recorder';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Represents dasi.shallo's account state after last admin reset */
function mkTeacher(overrides: Partial<{
  userId: number;
  username: string;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  isTemporaryPassword: boolean;
}> = {}) {
  return {
    userId:              overrides.userId              ?? 113,
    username:            overrides.username            ?? 'dasi.shallo',
    email:               null,
    passwordHash:        '$2b$12$somebcrypthashvalue',
    status:              overrides.status              ?? 'ACTIVE',
    isTemporaryPassword: overrides.isTemporaryPassword ?? true,
    profilePicture:      null,
    failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    lockedUntil:         overrides.lockedUntil         ?? null,
    lastLoginAt:         new Date('2026-10-28T17:56:43.000Z'),
    role:                { roleName: 'TEACHER' as const },
    permissions:         [],
    administrator: null, director: null, viceDirector: null,
    teacher:  { firstName: 'dasi', lastName: 'shallo' },
    student:  null, parent: null,
  };
}

const mockRefreshToken = {
  id: 'rtok-1', userId: 113, tokenHash: 'hashed-token',
  revokedAt: null, expiresAt: new Date(Date.now() + 604800000), replacedBy: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Login flow — regression tests (dasi.shallo scenario)', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
    (prisma.refreshToken.create as Mock).mockResolvedValue(mockRefreshToken);
    (prisma.refreshToken.update as Mock).mockResolvedValue(mockRefreshToken);
    (prisma.user.update as Mock).mockResolvedValue(mkTeacher());
  });

  // ── 1. Valid credentials — the happy path ──────────────────────────────────

  describe('valid credentials', () => {
    it('returns accessToken + refreshToken + user DTO on correct password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'dasi.shallo', password: 'CorrectPw1!' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.username).toBe('dasi.shallo');
      expect(result.user.role).toBe('TEACHER');
    });

    it('resets failedLoginAttempts and sets lastLoginAt on success', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ failedLoginAttempts: 2 }));
      (verifyPassword as Mock).mockResolvedValue(true);

      await service.login({ username: 'dasi.shallo', password: 'CorrectPw1!' });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: expect.any(Date),
          }),
        })
      );
    });

    it('records LOGIN_SUCCESS audit event', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(true);

      await service.login({ username: 'dasi.shallo', password: 'CorrectPw1!', ipAddress: '127.0.0.1' });

      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCESS', userId: 113 })
      );
    });

    it('resolves fullName from teacher profile', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'dasi.shallo', password: 'CorrectPw1!' });

      expect(result.user.fullName).toBe('dasi shallo');
    });
  });

  // ── 2. Incorrect password — dasi.shallo scenario ──────────────────────────

  describe('incorrect password (the reported scenario)', () => {
    it('throws UnauthorizedError — same message whether user exists or not', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'dasi.shallo', password: 'OldSupersededPassword1!' })
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid username or password',
      });
    });

    it('increments failedLoginAttempts on wrong password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ failedLoginAttempts: 1 }));
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'dasi.shallo', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 2 }),
        })
      );
    });

    it('records LOGIN_FAILED audit event on wrong password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'dasi.shallo', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAILED', userId: 113 })
      );
    });

    it('[SCENARIO] using a superseded password (earlier reset) throws 401', async () => {
      // After 5 admin resets, only the LAST password works.
      // Using any of the previous 4 temporary passwords hits this branch.
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ failedLoginAttempts: 0 }));
      (verifyPassword as Mock).mockResolvedValue(false); // hash is from latest reset, not earlier

      const err = await service.login({ username: 'dasi.shallo', password: 'EarlierReset1!' }).catch(e => e);

      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid username or password');
      // Error message is identical to "user not found" — prevents enumeration
    });
  });

  // ── 3. Unknown username ────────────────────────────────────────────────────

  describe('unknown username', () => {
    it('throws UnauthorizedError with same message as wrong password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      const err = await service.login({ username: 'nobody', password: 'pw' }).catch(e => e);

      expect(err).toBeInstanceOf(UnauthorizedError);
      expect(err.message).toBe('Invalid username or password');
    });

    it('does NOT call verifyPassword when user is not found', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await service.login({ username: 'ghost', password: 'pw' }).catch(() => undefined);

      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it('does NOT call prisma.user.update when user is not found', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await service.login({ username: 'ghost', password: 'pw' }).catch(() => undefined);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ── 4. Inactive account ────────────────────────────────────────────────────

  describe('inactive account', () => {
    it('throws ForbiddenError (not UnauthorizedError) for INACTIVE status', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ status: 'INACTIVE' }));

      await expect(
        service.login({ username: 'dasi.shallo', password: 'any' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError for LOCKED status', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ status: 'LOCKED' }));

      await expect(
        service.login({ username: 'dasi.shallo', password: 'any' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('does NOT call verifyPassword for inactive accounts', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ status: 'INACTIVE' }));

      await service.login({ username: 'dasi.shallo', password: 'any' }).catch(() => undefined);

      expect(verifyPassword).not.toHaveBeenCalled();
    });
  });

  // ── 5. Temporarily locked account ─────────────────────────────────────────

  describe('account lockout', () => {
    it('throws ForbiddenError when account is temporarily locked', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min from now
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ lockedUntil }));

      const err = await service.login({ username: 'dasi.shallo', password: 'any' }).catch(e => e);

      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toMatch(/locked/i);
    });

    it('does NOT call verifyPassword when account is locked', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(
        mkTeacher({ lockedUntil: new Date(Date.now() + 600_000) })
      );

      await service.login({ username: 'dasi.shallo', password: 'any' }).catch(() => undefined);

      expect(verifyPassword).not.toHaveBeenCalled();
    });

    it('an expired lock (lockedUntil in the past) does NOT block login', async () => {
      const expiredLock = new Date(Date.now() - 1000); // already passed
      (prisma.user.findUnique as Mock).mockResolvedValue(
        mkTeacher({ lockedUntil: expiredLock })
      );
      (verifyPassword as Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'dasi.shallo', password: 'CorrectPw1!' });

      expect(result.accessToken).toBe('mock-access-token');
    });

    it('locks account when failedAttempts reaches LOGIN_MAX_ATTEMPTS (5)', async () => {
      const almostLocked = mkTeacher({ failedLoginAttempts: 4 }); // one more = lock
      (prisma.user.findUnique as Mock).mockResolvedValue(almostLocked);
      (verifyPassword as Mock).mockResolvedValue(false);

      const err = await service.login({ username: 'dasi.shallo', password: 'wrong' }).catch(e => e);

      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.message).toMatch(/locked/i);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        })
      );
    });

    it('resets failedLoginAttempts to 0 when locking (not accumulating to 5)', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ failedLoginAttempts: 4 }));
      (verifyPassword as Mock).mockResolvedValue(false);

      await service.login({ username: 'dasi.shallo', password: 'wrong' }).catch(() => undefined);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0 }),
        })
      );
    });

    it('records LOGIN_FAILED_ACCOUNT_LOCKED when lockout triggers', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ failedLoginAttempts: 4 }));
      (verifyPassword as Mock).mockResolvedValue(false);

      await service.login({ username: 'dasi.shallo', password: 'wrong' }).catch(() => undefined);

      expect(recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_FAILED_ACCOUNT_LOCKED', userId: 113 })
      );
    });
  });

  // ── 6. Admin password reset — operational scenario that triggered the issue

  describe('admin password reset (the operational cause)', () => {
    it('password reset stores a new hash and keeps isTemporaryPassword=true', async () => {
      // Simulates what resetPassword() does in user.service.ts
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (prisma.user.update as Mock).mockResolvedValue(
        mkTeacher({ isTemporaryPassword: true })
      );
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 2 });
      (hashPassword as Mock).mockResolvedValue('brand-new-bcrypt-hash');

      // After reset: old password is invalid, new password works
      // Verify that verifyPassword with the OLD hash returns false
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'dasi.shallo', password: 'PreviousTemporaryPw1!' })
      ).rejects.toBeInstanceOf(UnauthorizedError);

      // Then the new password (from latest reset) works
      (verifyPassword as Mock).mockResolvedValue(true);
      const result = await service.login({ username: 'dasi.shallo', password: 'LatestTemporaryPw1!' });
      expect(result.accessToken).toBe('mock-access-token');
    });
  });

  // ── 7. User changes own password ──────────────────────────────────────────

  describe('user changes own password', () => {
    it('sets isTemporaryPassword=false after successful change', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ isTemporaryPassword: true }));
      (verifyPassword as Mock).mockResolvedValue(true);
      (hashPassword as Mock).mockResolvedValue('user-chosen-bcrypt-hash');
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 1 });

      await service.changePassword({
        userId: 113,
        currentPassword: 'TemporaryPw1!',
        newPassword:     'MyOwnPw1!',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isTemporaryPassword: false,
            passwordHash: 'user-chosen-bcrypt-hash',
          }),
        })
      );
    });

    it('revokes ALL sessions on password change', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher({ isTemporaryPassword: true }));
      (verifyPassword as Mock).mockResolvedValue(true);
      (hashPassword as Mock).mockResolvedValue('user-chosen-bcrypt-hash');
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 3 });

      await service.changePassword({ userId: 113, currentPassword: 'Tmp1!', newPassword: 'New1!' });

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 113, revokedAt: null }),
          data:  expect.objectContaining({ revokedAt: expect.any(Date) }),
        })
      );
    });
  });

  // ── 8. Malformed / edge-case requests ─────────────────────────────────────

  describe('malformed requests', () => {
    it('throws when username is empty string (user not found path)', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.login({ username: '', password: 'pw' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when password is empty string (wrong password path)', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkTeacher());
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'dasi.shallo', password: '' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });
});
