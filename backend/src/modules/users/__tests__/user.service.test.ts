/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * UserService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma, env, audit, and utilities BEFORE importing service ───────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    role:         { findUnique: vi.fn() },
    user:         { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

vi.mock('../../../core/utils/password.util', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed'),
}));

vi.mock('../../../core/utils/code-generator.util', () => ({
  buildBaseUsername:       vi.fn().mockReturnValue('tomtadesse'),
  ensureUniqueUsername:    vi.fn().mockResolvedValue('tomtadesse'),
  generateTemporaryPassword: vi.fn().mockReturnValue('TempPass1!'),
}));

import { UserService } from '../user.service';
import { prisma } from '../../../database/prisma-client';
import { recordAudit } from '../../../core/audit/audit-recorder';
import { hashPassword } from '../../../core/utils/password.util';
import { buildBaseUsername, ensureUniqueUsername, generateTemporaryPassword } from '../../../core/utils/code-generator.util';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkUser(role = 'TEACHER') {
  return {
    userId:              1,
    username:            'tomtadesse',
    email:               null,
    status:              'ACTIVE',
    failedLoginAttempts: 0,
    lockedUntil:         null,
    lastLoginAt:         null,
    createdAt:           new Date(),
    role:                { roleName: role },
    administrator:       null,
    director:            null,
    viceDirector:        null,
    parent:              null,
    student:             null,
    teacher:             { teacherId: 100, firstName: 'Tom', lastName: 'Tadesse' },
  };
}

const ACTOR = { userId: 99, ipAddress: '127.0.0.1' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
    vi.resetAllMocks();
    // Re-apply utility mock implementations after reset
    (hashPassword as Mock).mockResolvedValue('hashed');
    (buildBaseUsername as Mock).mockReturnValue('tomtadesse');
    (ensureUniqueUsername as Mock).mockResolvedValue('tomtadesse');
    (generateTemporaryPassword as Mock).mockReturnValue('TempPass1!');
  });

  // ── createStaff ───────────────────────────────────────────────────────────

  describe('createStaff', () => {
    const teacherInput = {
      firstName:       'Tom',
      lastName:        'Tadesse',
      role:            'TEACHER' as const,
      email:           'tom@school.et',
      qualification:   'BSc',
      specialization:  'Mathematics',
      phoneNumber:     '+251900000001',
    };

    it('creates a TEACHER user and returns user DTO + credentials', async () => {
      const role = { roleId: 2, roleName: 'TEACHER' };
      (prisma.role.findUnique as Mock).mockResolvedValue(role);
      (prisma.user.findUnique as Mock).mockResolvedValue(null); // no duplicate email
      (prisma.user.create    as Mock).mockResolvedValue(mkUser('TEACHER'));

      const result = await service.createStaff(teacherInput, ACTOR);

      expect(prisma.user.create).toHaveBeenCalledOnce();
      expect(result.user).toMatchObject({ username: 'tomtadesse', role: 'TEACHER' });
      expect(result.credentials).toMatchObject({
        username:          'tomtadesse',
        temporaryPassword: 'TempPass1!',
      });
    });

    it('throws 422 ValidationError when the role is not found in the system', async () => {
      (prisma.role.findUnique as Mock).mockResolvedValue(null);

      await expect(service.createStaff(teacherInput, ACTOR)).rejects.toMatchObject({ statusCode: 422 });

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('throws 409 ConflictError when the email is already taken', async () => {
      const role = { roleId: 2, roleName: 'TEACHER' };
      (prisma.role.findUnique as Mock).mockResolvedValue(role);
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser()); // email already exists

      await expect(service.createStaff(teacherInput, ACTOR)).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('calls recordAudit after successful creation', async () => {
      const role = { roleId: 2, roleName: 'TEACHER' };
      (prisma.role.findUnique as Mock).mockResolvedValue(role);
      (prisma.user.findUnique as Mock).mockResolvedValue(null);
      (prisma.user.create    as Mock).mockResolvedValue(mkUser('TEACHER'));

      await service.createStaff(teacherInput, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.userId).toBe(ACTOR.userId);
      expect(auditArg.action).toBe('STAFF_ACCOUNT_CREATED');
      expect(auditArg.entity).toBe('User');
    });
  });

  // ── listTeachers ──────────────────────────────────────────────────────────

  describe('listTeachers', () => {
    it('returns a list of teacher users for the TEACHER role', async () => {
      const teacherRole = { roleId: 2, roleName: 'TEACHER' };
      (prisma.role.findUnique as Mock).mockResolvedValue(teacherRole);
      (prisma.user.findMany  as Mock).mockResolvedValue([mkUser('TEACHER')]);

      const result = await service.listTeachers();

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('TEACHER');
      // Query must filter by roleId and ACTIVE status
      const findManyCall = (prisma.user.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ roleId: teacherRole.roleId, status: 'ACTIVE' });
    });

    it('returns empty array when TEACHER role is not configured', async () => {
      (prisma.role.findUnique as Mock).mockResolvedValue(null);

      const result = await service.listTeachers();

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ── listUsers ─────────────────────────────────────────────────────────────

  describe('listUsers', () => {
    it('returns items and pagination meta', async () => {
      (prisma.user.findMany as Mock).mockResolvedValue([mkUser('ADMIN'), mkUser('TEACHER')]);
      (prisma.user.count   as Mock).mockResolvedValue(2);

      const result = await service.listUsers({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });

    it('restricts to staff roles and never includes STUDENT or PARENT', async () => {
      (prisma.user.findMany as Mock).mockResolvedValue([]);
      (prisma.user.count   as Mock).mockResolvedValue(0);

      await service.listUsers({ page: 1, limit: 20 });

      const findManyCall = (prisma.user.findMany as Mock).mock.calls[0][0];
      const roleFilter = findManyCall.where.role.roleName;
      expect(roleFilter.in).toBeDefined();
      expect(roleFilter.in).not.toContain('STUDENT');
      expect(roleFilter.in).not.toContain('PARENT');
    });

    it('filters by specific role when role query param is provided', async () => {
      (prisma.user.findMany as Mock).mockResolvedValue([mkUser('TEACHER')]);
      (prisma.user.count   as Mock).mockResolvedValue(1);

      await service.listUsers({ page: 1, limit: 20, role: 'TEACHER' as any });

      const findManyCall = (prisma.user.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where.role.roleName.in).toEqual(['TEACHER']);
    });

    it('includes search filter as OR clause when search is provided', async () => {
      (prisma.user.findMany as Mock).mockResolvedValue([]);
      (prisma.user.count   as Mock).mockResolvedValue(0);

      await service.listUsers({ page: 1, limit: 20, search: 'tom' });

      const findManyCall = (prisma.user.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('OR');
    });
  });

  // ── getUserById ───────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('returns UserSummaryDto when user exists', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser('TEACHER'));

      const result = await service.getUserById(1);

      expect(result).toMatchObject({ userId: 1, username: 'tomtadesse', role: 'TEACHER' });
    });

    it('throws 404 NotFoundError when user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getUserById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates the user status and returns the updated DTO', async () => {
      const user    = mkUser('TEACHER');
      const updated = { ...user, status: 'INACTIVE' };
      (prisma.user.findUnique as Mock).mockResolvedValue(user); // assertExists
      (prisma.user.update    as Mock).mockResolvedValue(updated);

      const result = await service.updateStatus(1, 'INACTIVE' as any, ACTOR);

      expect(prisma.user.update).toHaveBeenCalledOnce();
      expect(result.status).toBe('INACTIVE');
    });

    it('throws 404 NotFoundError when the target user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.updateStatus(999, 'INACTIVE' as any, ACTOR)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('revokes active sessions when status is not ACTIVE', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue({ ...user, status: 'SUSPENDED' });
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 1 });

      await service.updateStatus(1, 'SUSPENDED' as any, ACTOR);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data:  { revokedAt: expect.any(Date) },
      });
    });

    it('does NOT revoke sessions when status is set to ACTIVE', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue({ ...user, status: 'ACTIVE' });

      await service.updateStatus(1, 'ACTIVE' as any, ACTOR);

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('calls recordAudit after a successful status update', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue({ ...user, status: 'INACTIVE' });

      await service.updateStatus(1, 'INACTIVE' as any, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('USER_STATUS_UPDATED');
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('returns username and a new temporaryPassword', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue(user);
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

      const result = await service.resetPassword(1, ACTOR);

      expect(result).toMatchObject({
        username:          'tomtadesse',
        temporaryPassword: 'TempPass1!',
      });
    });

    it('throws 404 NotFoundError when user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.resetPassword(999, ACTOR)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('calls recordAudit after a successful password reset', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue(user);
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

      await service.resetPassword(1, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('USER_PASSWORD_RESET');
    });

    it('revokes active sessions after resetting the password', async () => {
      const user = mkUser('TEACHER');
      (prisma.user.findUnique as Mock).mockResolvedValue(user);
      (prisma.user.update    as Mock).mockResolvedValue(user);
      (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 2 });

      await service.resetPassword(1, ACTOR);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revokedAt: null },
        data:  { revokedAt: expect.any(Date) },
      });
    });
  });
});
