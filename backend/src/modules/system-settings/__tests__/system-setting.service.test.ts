/**
 * SystemSettingService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma, env, and audit recorder BEFORE importing service ─────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    systemSetting: { upsert: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

import { SystemSettingService } from '../system-setting.service';
import { prisma } from '../../../database/prisma-client';
import { recordAudit } from '../../../core/audit/audit-recorder';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkSettingRow(overrides: Partial<{
  schoolName: string;
  updatedByUsername: string | null;
}> = {}) {
  return {
    schoolName:             overrides.schoolName ?? 'Test School',
    schoolAddress:          '123 St',
    schoolZone:             'Zone A',
    schoolWereda:           'Wereda 1',
    schoolRegion:           'Oromia',
    contactEmail:           'test@school.et',
    contactPhone:           '+251911',
    currentAcademicYear:    '2026/27',
    schoolLogo:             null,
    // promotionPassMark and minimumSubjectPassMark: the service calls Number() on these.
    // Using plain numbers works since Number(50) === 50.
    promotionPassMark:      50,
    minimumSubjectPassMark: 40,
    updatedAt:              new Date('2026-09-01T10:00:00Z'),
    updatedBy:              overrides.updatedByUsername !== undefined
      ? (overrides.updatedByUsername ? { username: overrides.updatedByUsername } : null)
      : { username: 'admin' },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SystemSettingService', () => {
  let service: SystemSettingService;

  beforeEach(() => {
    service = new SystemSettingService();
    vi.resetAllMocks();
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns a fully-populated DTO from the upserted settings row', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(mkSettingRow());

      const result = await service.get();

      expect(prisma.systemSetting.upsert).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        schoolName:             'Test School',
        schoolAddress:          '123 St',
        schoolZone:             'Zone A',
        schoolWereda:           'Wereda 1',
        schoolRegion:           'Oromia',
        contactEmail:           'test@school.et',
        contactPhone:           '+251911',
        currentAcademicYear:    '2026/27',
        schoolLogo:             null,
        promotionPassMark:      50,
        minimumSubjectPassMark: 40,
        updatedByUsername:      'admin',
      });
    });

    it('creates a default row via upsert when none exists (defensive fallback)', async () => {
      // upsert always returns the row (create path), simulating a fresh DB
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(
        mkSettingRow({ schoolName: 'My School', updatedByUsername: null })
      );

      const result = await service.get();

      // Verify upsert was called with id=1 (SETTINGS_ROW_ID)
      const upsertArg = (prisma.systemSetting.upsert as Mock).mock.calls[0][0];
      expect(upsertArg.where).toMatchObject({ id: 1 });
      expect(upsertArg.create).toMatchObject({ id: 1 });
      expect(result.schoolName).toBe('My School');
      expect(result.updatedByUsername).toBeNull();
    });

    it('casts Prisma Decimal promotionPassMark to a number', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(mkSettingRow());

      const result = await service.get();

      expect(typeof result.promotionPassMark).toBe('number');
      expect(typeof result.minimumSubjectPassMark).toBe('number');
    });

    it('returns ISO string for updatedAt', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(mkSettingRow());

      const result = await service.get();

      expect(typeof result.updatedAt).toBe('string');
      expect(result.updatedAt).toBe(new Date('2026-09-01T10:00:00Z').toISOString());
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    const actor = { userId: 1, ipAddress: '127.0.0.1' };
    const updateInput = {
      schoolName:          'Updated School',
      contactEmail:        'updated@school.et',
      currentAcademicYear: '2027/28',
      promotionPassMark:   55,
      minimumSubjectPassMark: 45,
    };

    it('updates fields and returns the updated DTO', async () => {
      const updatedRow = mkSettingRow({ schoolName: 'Updated School', updatedByUsername: 'admin' });
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(updatedRow);

      const result = await service.update(updateInput, actor);

      expect(prisma.systemSetting.upsert).toHaveBeenCalledOnce();

      // Verify the update clause includes the input fields + updatedByUserId
      const upsertArg = (prisma.systemSetting.upsert as Mock).mock.calls[0][0];
      expect(upsertArg.update).toMatchObject({ ...updateInput, updatedByUserId: actor.userId });
      expect(result.schoolName).toBe('Updated School');
    });

    it('calls recordAudit with correct entity and actor userId', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(mkSettingRow());

      await service.update(updateInput, actor);

      expect(recordAudit).toHaveBeenCalledOnce();
      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.userId).toBe(actor.userId);
      expect(auditArg.entity).toBe('SystemSetting');
      expect(auditArg.action).toBe('SYSTEM_SETTINGS_UPDATED');
    });

    it('does NOT include schoolLogo in audit metadata', async () => {
      const inputWithLogo = { ...updateInput, schoolLogo: 'data:image/png;base64,AAAA' };
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(mkSettingRow());

      await service.update(inputWithLogo, actor);

      const auditArg = (recordAudit as Mock).mock.calls[0][0];
      expect(auditArg.metadata).not.toHaveProperty('schoolLogo');
    });

    it('returns updatedByUsername from the upserted row', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(
        mkSettingRow({ updatedByUsername: 'admin' })
      );

      const result = await service.update(updateInput, actor);

      expect(result.updatedByUsername).toBe('admin');
    });

    it('returns null updatedByUsername when updatedBy relation is null', async () => {
      (prisma.systemSetting.upsert as Mock).mockResolvedValue(
        mkSettingRow({ updatedByUsername: null })
      );

      const result = await service.update(updateInput, actor);

      expect(result.updatedByUsername).toBeNull();
    });
  });
});
