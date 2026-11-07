/**
 * ParentService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 * Note: createParent uses an optional transaction client that defaults to `prisma`.
 *       In tests we call it without a client, so the mocked `prisma` is used directly.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma, env, and utilities BEFORE importing service ──────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user:         { findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    role:         { findUnique: vi.fn() },
    parent:       { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    auditLog:     { create: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

vi.mock('../../../core/utils/password.util', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../../../core/utils/code-generator.util', () => ({
  buildBaseUsername:          vi.fn().mockReturnValue('papap'),
  ensureUniqueUsername:       vi.fn().mockResolvedValue('papap'),
  generateTemporaryPassword:  vi.fn().mockReturnValue('TempPass1!'),
}));

import { ParentService } from '../parent.service';
import { prisma } from '../../../database/prisma-client';
import { hashPassword } from '../../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../../core/utils/code-generator.util';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkParent(overrides: Partial<{ parentId: number; userId: number }> = {}) {
  const parentId = overrides.parentId ?? 10;
  const userId   = overrides.userId   ?? 100;
  return {
    parentId,
    userId,
    fullName:    'Papa P',
    phoneNumber: '+251911',
    user:        { userId, username: 'papap', email: null, status: 'ACTIVE' },
    links:       [],
  };
}

function mkCreatedUserWithParent() {
  const parent = mkParent();
  return {
    userId:   100,
    username: 'papap',
    email:    null,
    parent: {
      ...parent,
      user:  { userId: 100, username: 'papap', email: null, status: 'ACTIVE' },
      links: [],
    },
  };
}

function mkParentWithRole(overrides: { roleName?: string; parentId?: number } = {}) {
  return {
    parentId: overrides.parentId ?? 10,
    userId: 100,
    fullName: 'Papa P',
    phoneNumber: '+251911',
    user: {
      userId: 100,
      username: 'papap',
      email: null,
      status: 'ACTIVE',
      role: { roleName: overrides.roleName ?? 'PARENT' },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ParentService', () => {
  let service: ParentService;

  beforeEach(() => {
    service = new ParentService();
    vi.resetAllMocks();
    (hashPassword as Mock).mockResolvedValue('hashed');
    (buildBaseUsername as Mock).mockReturnValue('papap');
    (ensureUniqueUsername as Mock).mockResolvedValue('papap');
    (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!');
  });

  // ── createParent ──────────────────────────────────────────────────────────

  describe('createParent', () => {
    const createInput = {
      fullName:    'Papa P',
      phoneNumber: '+251911',
      email:       'papap@test.et',
    };

    it('creates a parent user and returns DTO with credentials', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.role.findUnique as Mock).mockResolvedValue({ roleId: 5, roleName: 'PARENT' });
      (prisma.user.create     as Mock).mockResolvedValue(mkCreatedUserWithParent());

      const result = await service.createParent(createInput);

      expect(prisma.user.create).toHaveBeenCalledOnce();
      expect(result.parent).toMatchObject({
        parentId:    10,
        fullName:    'Papa P',
        phoneNumber: '+251911',
        username:    'papap',
      });
      expect(result.credentials).toMatchObject({
        username:          'papap',
        temporaryPassword: 'TempPass1!',
      });
    });

    it('throws 409 ConflictError when the email is already taken', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 50 });
      await expect(service.createParent(createInput)).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.role.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws 422 ValidationError when the PARENT role is not configured', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.role.findUnique as Mock).mockResolvedValue(null);
      await expect(service.createParent(createInput)).rejects.toMatchObject({ statusCode: 422 });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('skips the email uniqueness check when no email is provided', async () => {
      const noEmailInput = { fullName: 'Papa P', phoneNumber: '+251911' };
      (prisma.role.findUnique as Mock).mockResolvedValue({ roleId: 5, roleName: 'PARENT' });
      (prisma.user.create     as Mock).mockResolvedValue(mkCreatedUserWithParent());

      await service.createParent(noEmailInput);

      const emailLookupCalls = (prisma.user.findUnique as Mock).mock.calls.filter(
        (call) => call[0]?.where?.email !== undefined
      );
      expect(emailLookupCalls).toHaveLength(0);
    });
  });

  // ── getParentById ─────────────────────────────────────────────────────────

  describe('getParentById', () => {
    it('returns ParentSummaryDto when parent exists', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(mkParent());
      const result = await service.getParentById(10);
      expect(result).toMatchObject({
        parentId:    10,
        fullName:    'Papa P',
        phoneNumber: '+251911',
        username:    'papap',
        children:    [],
      });
    });

    it('throws 404 NotFoundError when parent does not exist', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(null);
      await expect(service.getParentById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── getParentByUserId ─────────────────────────────────────────────────────

  describe('getParentByUserId', () => {
    it('returns ParentSummaryDto when parent exists for the userId', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(mkParent());
      const result = await service.getParentByUserId(100);
      expect(result).toMatchObject({ parentId: 10, userId: 100 });
    });

    it('throws 404 NotFoundError when no parent record exists for the userId', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(null);
      await expect(service.getParentByUserId(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── listParents ───────────────────────────────────────────────────────────

  describe('listParents', () => {
    it('returns items and pagination meta', async () => {
      const parents = [mkParent({}), mkParent({ parentId: 11, userId: 101 })];
      (prisma.parent.findMany as Mock).mockResolvedValue(parents);
      (prisma.parent.count   as Mock).mockResolvedValue(2);
      const result = await service.listParents({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });

    it('passes search filter as OR clause when search is provided', async () => {
      (prisma.parent.findMany as Mock).mockResolvedValue([mkParent()]);
      (prisma.parent.count   as Mock).mockResolvedValue(1);
      await service.listParents({ page: 1, limit: 20, search: 'papa' });
      const findManyCall = (prisma.parent.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('OR');
      expect(findManyCall.where.OR).toHaveLength(3);
    });

    it('passes empty where clause when no search is provided', async () => {
      (prisma.parent.findMany as Mock).mockResolvedValue([]);
      (prisma.parent.count   as Mock).mockResolvedValue(0);
      await service.listParents({ page: 1, limit: 20 });
      const findManyCall = (prisma.parent.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('OR');
    });

    it('returns empty items and correct meta when no parents exist', async () => {
      (prisma.parent.findMany as Mock).mockResolvedValue([]);
      (prisma.parent.count   as Mock).mockResolvedValue(0);
      const result = await service.listParents({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ── resetParentPassword ───────────────────────────────────────────────────

  describe('resetParentPassword', () => {
    const ACTOR_USER_ID = 1;
    const ACTOR_IP      = '127.0.0.1';
    const RESET_REASON  = 'Parent forgot password — requested via phone call';

    // Helper to set up the standard mocks for a successful reset
    function mockSuccessfulReset() {
      (prisma.parent.findUnique as Mock).mockResolvedValue(mkParentWithRole());
      (prisma.user.update as Mock).mockResolvedValue({});
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 1 });
      (prisma.auditLog.create as Mock).mockResolvedValue({});
    }

    it('generates a temporary password and returns username + temporaryPassword', async () => {
      mockSuccessfulReset();

      const result = await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      expect(result.username).toBe('papap');
      expect(result.temporaryPassword).toBe('TempPass1!');
    });

    it('hashes the temporary password before storing — never stores plaintext', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      expect(hashPassword).toHaveBeenCalledWith('TempPass1!');
      const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
      expect(updateCall.data.passwordHash).toBe('hashed');
      expect(JSON.stringify(updateCall.data)).not.toContain('TempPass1!');
    });

    it('sets isTemporaryPassword=true so first-login change is enforced', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
      expect(updateCall.data.isTemporaryPassword).toBe(true);
      expect(updateCall.data.failedLoginAttempts).toBe(0);
      expect(updateCall.data.status).toBe('ACTIVE');
    });

    it('revokes all active refresh tokens to invalidate existing sessions', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      const revokeCall = (prisma.refreshToken.updateMany as Mock).mock.calls[0][0];
      expect(revokeCall.where.userId).toBe(100);
      expect(revokeCall.where.revokedAt).toBe(null);
      expect(revokeCall.data.revokedAt).toBeInstanceOf(Date);
    });

    it('writes a PARENT_PASSWORD_RESET audit log entry with the reset reason', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      const auditCall = (prisma.auditLog.create as Mock).mock.calls[0][0];
      expect(auditCall.data.action).toBe('PARENT_PASSWORD_RESET');
      expect(auditCall.data.userId).toBe(ACTOR_USER_ID);
      expect(auditCall.data.ipAddress).toBe(ACTOR_IP);
      expect(auditCall.data.metadata.parentId).toBe(10);
      expect(auditCall.data.metadata.username).toBe('papap');
      expect(auditCall.data.metadata.reason).toBe(RESET_REASON);
    });

    it('preserves parent-child links — does not modify the links table', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      expect(prisma.parent.findUnique).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when parent does not exist', async () => {
      const { NotFoundError } = await import('../../../core/errors/app-error');
      (prisma.parent.findUnique as Mock).mockResolvedValue(null);

      await expect(service.resetParentPassword(999, ACTOR_USER_ID, RESET_REASON)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ForbiddenError when target account is not PARENT role', async () => {
      const { ForbiddenError } = await import('../../../core/errors/app-error');
      (prisma.parent.findUnique as Mock).mockResolvedValue(mkParentWithRole({ roleName: 'TEACHER' }));

      await expect(service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON)).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('does not update user or revoke tokens when role check fails', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(mkParentWithRole({ roleName: 'STUDENT' }));

      await expect(service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON)).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('records the admin actor ID in the audit log, not the parent user ID', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      const auditCall = (prisma.auditLog.create as Mock).mock.calls[0][0];
      expect(auditCall.data.userId).toBe(ACTOR_USER_ID);
      expect(auditCall.data.userId).not.toBe(100); // 100 is the parent's userId
    });

    it('clears lockedUntil and failedLoginAttempts to unblock a locked account', async () => {
      mockSuccessfulReset();

      await service.resetParentPassword(10, ACTOR_USER_ID, RESET_REASON, ACTOR_IP);

      const updateCall = (prisma.user.update as Mock).mock.calls[0][0];
      expect(updateCall.data.lockedUntil).toBe(null);
      expect(updateCall.data.failedLoginAttempts).toBe(0);
    });
  });
});
