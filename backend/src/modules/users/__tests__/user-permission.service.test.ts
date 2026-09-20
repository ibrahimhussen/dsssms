/**
 * UserPermissionService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma, env, and audit recorder BEFORE importing service ─────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user:           { findUnique: vi.fn() },
    userPermission: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

import { UserPermissionService } from '../user-permission.service';
import { prisma } from '../../../database/prisma-client';
import { recordAudit } from '../../../core/audit/audit-recorder';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkUser(userId = 10) {
  return { userId, username: 'testuser', status: 'ACTIVE' };
}

function mkPermission(id = 1, userId = 10, permission = 'VIEW_REPORTS') {
  return {
    id,
    userId,
    permission,
    grantedAt: new Date(),
    expiresAt: null,
  };
}

const ACTOR = { userId: 99, ipAddress: '127.0.0.1' };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserPermissionService', () => {
  let service: UserPermissionService;

  beforeEach(() => {
    service = new UserPermissionService();
    vi.resetAllMocks();
  });

  // ── getPermissions ────────────────────────────────────────────────────────

  describe('getPermissions', () => {
    it('returns a list of permissions for the user', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findMany as Mock).mockResolvedValue([
        mkPermission(1, 10, 'VIEW_REPORTS'),
        mkPermission(2, 10, 'EXPORT_DATA'),
      ]);

      const result = await service.getPermissions(10);

      expect(result).toHaveLength(2);
      expect(result[0].permission).toBe('VIEW_REPORTS');
    });

    it('returns an empty list when user exists but has no permissions', async () => {
      (prisma.user.findUnique  as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findMany as Mock).mockResolvedValue([]);

      const result = await service.getPermissions(10);

      expect(result).toEqual([]);
    });

    it('throws 404 NotFoundError when the user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getPermissions(999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.userPermission.findMany).not.toHaveBeenCalled();
    });
  });

  // ── grantPermission ───────────────────────────────────────────────────────

  describe('grantPermission', () => {
    const grantInput = { permission: 'VIEW_REPORTS' as any };

    it('creates a new permission when none exists for that userId+permission', async () => {
      const newPerm = mkPermission(5, 10, 'VIEW_REPORTS');
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(null); // no existing
      (prisma.userPermission.create     as Mock).mockResolvedValue(newPerm);

      const result = await service.grantPermission(10, grantInput, ACTOR);

      expect(prisma.userPermission.create).toHaveBeenCalledOnce();
      expect(prisma.userPermission.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 5, permission: 'VIEW_REPORTS' });
    });

    it('updates the expiresAt when the permission already exists for the same userId+permission', async () => {
      const existing = mkPermission(5, 10, 'VIEW_REPORTS');
      const updated  = { ...existing, expiresAt: new Date('2027-01-01') };
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(existing); // existing permission
      (prisma.userPermission.update     as Mock).mockResolvedValue(updated);

      const inputWithExpiry = { permission: 'VIEW_REPORTS' as any, expiresAt: new Date('2027-01-01') };
      const result = await service.grantPermission(10, inputWithExpiry, ACTOR);

      expect(prisma.userPermission.update).toHaveBeenCalledOnce();
      expect(prisma.userPermission.create).not.toHaveBeenCalled();
      expect(result.expiresAt).toEqual(new Date('2027-01-01'));
    });

    it('throws 404 NotFoundError when the user does not exist', async () => {
      (prisma.user.findUnique as Mock).mockResolvedValue(null);

      await expect(service.grantPermission(999, grantInput, ACTOR)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.userPermission.create).not.toHaveBeenCalled();
      expect(prisma.userPermission.update).not.toHaveBeenCalled();
    });

    it('calls recordAudit after creating a new permission', async () => {
      const newPerm = mkPermission(5, 10, 'VIEW_REPORTS');
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(null);
      (prisma.userPermission.create     as Mock).mockResolvedValue(newPerm);

      await service.grantPermission(10, grantInput, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('CREATE');
      expect(auditArg.entity).toBe('USER_PERMISSION');
    });

    it('calls recordAudit after updating an existing permission', async () => {
      const existing = mkPermission(5, 10, 'VIEW_REPORTS');
      (prisma.user.findUnique as Mock).mockResolvedValue(mkUser());
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(existing);
      (prisma.userPermission.update     as Mock).mockResolvedValue(existing);

      await service.grantPermission(10, grantInput, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('UPDATE');
    });
  });

  // ── revokePermission ──────────────────────────────────────────────────────

  describe('revokePermission', () => {
    it('deletes the permission when found and userId matches', async () => {
      const perm = mkPermission(5, 10, 'VIEW_REPORTS');
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(perm);

      await service.revokePermission(10, 5, ACTOR);

      expect(prisma.userPermission.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });

    it('throws 404 NotFoundError when the permission record does not exist', async () => {
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(null);

      await expect(service.revokePermission(10, 999, ACTOR)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.userPermission.delete).not.toHaveBeenCalled();
    });

    it('throws 404 NotFoundError when the permission belongs to a different userId', async () => {
      // Permission exists but belongs to userId=20, not userId=10
      const perm = mkPermission(5, 20, 'VIEW_REPORTS');
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(perm);

      await expect(service.revokePermission(10, 5, ACTOR)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.userPermission.delete).not.toHaveBeenCalled();
    });

    it('calls recordAudit after a successful revocation', async () => {
      const perm = mkPermission(5, 10, 'VIEW_REPORTS');
      (prisma.userPermission.findUnique as Mock).mockResolvedValue(perm);

      await service.revokePermission(10, 5, ACTOR);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.action).toBe('DELETE');
      expect(auditArg.entity).toBe('USER_PERMISSION');
      expect(auditArg.entityId).toBe('5');
    });
  });
});
