/**
 * Phase 4.9 — AuditLogService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    auditLog: { findMany: vi.fn(), count: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { AuditLogService } from '../audit-log.service';
import { prisma } from '../../../database/prisma-client';

function mkLog(id = 1) {
  return {
    id: BigInt(id),
    userId: 1,
    action: 'STAFF_ACCOUNT_CREATED',
    entity: 'User',
    entityId: String(id),
    ipAddress: '127.0.0.1',
    metadata: { role: 'TEACHER' },
    createdAt: new Date('2026-09-10T10:00:00Z'),
    user: { username: 'admin', role: { roleName: 'ADMIN' } },
  };
}

describe('AuditLogService', () => {
  let svc: AuditLogService;
  beforeEach(() => { svc = new AuditLogService(); vi.resetAllMocks(); });

  describe('list', () => {
    it('returns items and pagination meta', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([mkLog()]);
      (prisma.auditLog.count as Mock).mockResolvedValue(1);
      const r = await svc.list({ page: 1, limit: 20 });
      expect(r.items).toHaveLength(1);
      expect(r.meta.totalItems).toBe(1);
    });

    it('DTO has all expected fields', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([mkLog(42)]);
      (prisma.auditLog.count as Mock).mockResolvedValue(1);
      const r = await svc.list({ page: 1, limit: 20 });
      const item = r.items[0];
      expect(item.action).toBe('STAFF_ACCOUNT_CREATED');
      expect(item.entity).toBe('User');
      expect(item.username).toBe('admin');
      expect(item.role).toBe('ADMIN');
      expect(typeof item.createdAt).toBe('string');
    });

    it('filters by action when provided', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      await svc.list({ page: 1, limit: 10, action: 'STAFF_ACCOUNT_CREATED' });
      const where = (prisma.auditLog.findMany as Mock).mock.calls[0][0].where;
      expect(where.action).toEqual({ contains: 'STAFF_ACCOUNT_CREATED' });
    });

    it('filters by entity when provided', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      await svc.list({ page: 1, limit: 10, entity: 'User' });
      const where = (prisma.auditLog.findMany as Mock).mock.calls[0][0].where;
      expect(where.entity).toBe('User');
    });

    it('filters by userId when provided', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      await svc.list({ page: 1, limit: 10, userId: 5 });
      const where = (prisma.auditLog.findMany as Mock).mock.calls[0][0].where;
      expect(where.userId).toBe(5);
    });

    it('builds date range filter from from/to params', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      await svc.list({ page: 1, limit: 10, from: '2026-01-01', to: '2026-12-31' });
      const where = (prisma.auditLog.findMany as Mock).mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it('throws BadRequestError when from date is invalid', async () => {
      await expect(
        svc.list({ page: 1, limit: 10, from: 'not-a-date' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('returns empty items with correct meta when no logs', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      const r = await svc.list({ page: 1, limit: 20 });
      expect(r.items).toHaveLength(0);
      expect(r.meta.totalItems).toBe(0);
    });

    it('orders by createdAt desc', async () => {
      (prisma.auditLog.findMany as Mock).mockResolvedValue([]);
      (prisma.auditLog.count as Mock).mockResolvedValue(0);
      await svc.list({ page: 1, limit: 20 });
      const orderBy = (prisma.auditLog.findMany as Mock).mock.calls[0][0].orderBy;
      expect(orderBy).toEqual({ createdAt: 'desc' });
    });
  });
});
