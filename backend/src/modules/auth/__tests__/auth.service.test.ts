/**
 * Auth Service Tests
 * Tests cover: login (success, bad password, locked, inactive),
 * token refresh (valid, expired, tampered), logout, change password.
 * All Prisma calls are mocked — no database required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AuthService } from '../auth.service';
import { ForbiddenError, UnauthorizedError } from '../../../core/errors/app-error';

// ── Mock heavy dependencies ───────────────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user: {
      findUnique:  vi.fn(),
      update:      vi.fn(),
    },
    refreshToken: {
      create:      vi.fn(),
      update:      vi.fn(),
      updateMany:  vi.fn(),
      findUnique:  vi.fn(),
    },
  },
}));

vi.mock('../../../core/utils/password.util', () => ({
  verifyPassword: vi.fn(),
  hashPassword:   vi.fn(),
}));

vi.mock('../../../core/utils/jwt.util', () => ({
  signAccessToken:   vi.fn().mockReturnValue('mock-access-token'),
  signRefreshToken:  vi.fn().mockReturnValue('mock-refresh-token'),
  verifyRefreshToken: vi.fn(),
}));

vi.mock('../../../core/utils/token.util', () => ({
  hashToken:             vi.fn().mockReturnValue('hashed-token'),
  durationToFutureDate:  vi.fn().mockReturnValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
}));

vi.mock('../../../core/audit/audit-recorder', () => ({
  recordAudit: vi.fn(),
}));

vi.mock('../../../config/env', () => ({
  env: {
    LOGIN_MAX_ATTEMPTS:    5,
    LOGIN_LOCKOUT_MINUTES: 15,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    BCRYPT_SALT_ROUNDS:    12,
  },
  isProduction: false,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { prisma }          from '../../../database/prisma-client';
import { verifyPassword, hashPassword } from '../../../core/utils/password.util';
import { verifyRefreshToken } from '../../../core/utils/jwt.util';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser = {
  userId:              1,
  username:            'testuser',
  email:               'test@example.com',
  passwordHash:        'hashed-pw',
  status:              'ACTIVE',
  isTemporaryPassword: false,
  profilePicture:      null,
  failedLoginAttempts: 0,
  lockedUntil:         null,
  lastLoginAt:         null,
  role:                { roleName: 'TEACHER' as const },
  permissions:         [],
  administrator:       null,
  director:            null,
  viceDirector:        null,
  teacher:             { firstName: 'Test', lastName: 'User' },
  student:             null,
  parent:              null,
};

const mockRefreshTokenRecord = {
  id:         'token-uuid-1',
  userId:     1,
  tokenHash:  'hashed-token',
  revokedAt:  null,
  expiresAt:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  replacedBy: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    vi.clearAllMocks();
    // Default: issueTokenPair sequence
    (prisma.refreshToken.create as Mock).mockResolvedValue({ ...mockRefreshTokenRecord });
    (prisma.refreshToken.update as Mock).mockResolvedValue({ ...mockRefreshTokenRecord });
    (prisma.user.update as Mock).mockResolvedValue(mockUser);
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken and user on valid credentials', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);

      const result = await service.login({ username: 'testuser', password: 'ValidPw1!' });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.username).toBe('testuser');
      expect(result.user.role).toBe('TEACHER');
    });

    it('throws UnauthorizedError when user not found', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.login({ username: 'nobody', password: 'pw' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError on wrong password', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testuser', password: 'wrong' })
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws ForbiddenError when account is inactive', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue({ ...mockUser, status: 'INACTIVE' });

      await expect(
        service.login({ username: 'testuser', password: 'pw' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError when account is locked', async () => {
      const lockedUser = {
        ...mockUser,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
      };
      (prisma.user.findUnique as Mock).mockResolvedValue(lockedUser);

      await expect(
        service.login({ username: 'testuser', password: 'pw' })
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('locks account after max failed attempts', async () => {
      const almostLockedUser = { ...mockUser, failedLoginAttempts: 4 }; // one more = lock
      (prisma.user.findUnique as Mock).mockResolvedValue(almostLockedUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testuser', password: 'wrong' })
      ).rejects.toBeInstanceOf(ForbiddenError);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
        })
      );
    });
  });

  // ── refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('issues a new access token on valid refresh token', async () => {
      (verifyRefreshToken as Mock).mockReturnValue({ jti: 'token-uuid-1' });
      (prisma.refreshToken.findUnique as Mock).mockResolvedValue(mockRefreshTokenRecord);
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);

      const result = await service.refresh('mock-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-refresh-token');
    });

    it('throws UnauthorizedError when refresh token is revoked', async () => {
      (verifyRefreshToken as Mock).mockReturnValue({ jti: 'token-uuid-1' });
      (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        revokedAt: new Date(),
      });

      await expect(service.refresh('revoked-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when token hash does not match (tampered token)', async () => {
      (verifyRefreshToken as Mock).mockReturnValue({ jti: 'token-uuid-1' });
      (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
        ...mockRefreshTokenRecord,
        tokenHash: 'different-hash', // hash mismatch = compromised
      });

      await expect(service.refresh('tampered-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('throws UnauthorizedError when JWT verification fails', async () => {
      (verifyRefreshToken as Mock).mockImplementation(() => { throw new Error('expired'); });

      await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token on logout', async () => {
      (verifyRefreshToken as Mock).mockReturnValue({ jti: 'token-uuid-1' });

      await service.logout('mock-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'token-uuid-1', revokedAt: null }),
          data:  expect.objectContaining({ revokedAt: expect.any(Date) }),
        })
      );
    });

    it('does not throw on invalid token (logout is idempotent)', async () => {
      (verifyRefreshToken as Mock).mockImplementation(() => { throw new Error('invalid'); });

      await expect(service.logout('bad-token')).resolves.toBeUndefined();
    });
  });

  // ── changePassword ─────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('changes password and invalidates all sessions', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(true);
      (hashPassword as Mock).mockResolvedValue('new-hashed-pw');
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 2 });

      await service.changePassword({
        userId:          1,
        currentPassword: 'OldPw1!',
        newPassword:     'NewPw1!',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash:        'new-hashed-pw',
            isTemporaryPassword: false,
          }),
        })
      );
      // All sessions should be revoked
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('throws BadRequestError when current password is wrong', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mockUser);
      (verifyPassword as Mock).mockResolvedValue(false);

      const { BadRequestError } = await import('../../../core/errors/app-error');
      await expect(
        service.changePassword({ userId: 1, currentPassword: 'wrong', newPassword: 'NewPw1!' })
      ).rejects.toBeInstanceOf(BadRequestError);
    });
  });
});
