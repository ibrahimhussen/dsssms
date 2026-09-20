/**
 * Phase 4.8 — GradeSubjectConfigService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GradeSubjectConfigService } from '../grade-subject-config.service';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    gradeSubjectConfig: { findMany: vi.fn(), groupBy: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), createMany: vi.fn() },
    subject:            { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

import { prisma } from '../../../database/prisma-client';

const DIR  = { userId: 1, role: 'DIRECTOR'      as const, username: 'dir' };
const VD   = { userId: 2, role: 'VICE_DIRECTOR'  as const, username: 'vd'  };
const ADM  = { userId: 3, role: 'ADMIN'          as const, username: 'adm' };
const TCH  = { userId: 4, role: 'TEACHER'        as const, username: 'tch' };

const SUB = { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' };
function mkRow(id = 1) {
  return { id, className: 'Grade 9', academicYear: '2026/27', subjectId: 1, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), subject: SUB };
}

describe('GradeSubjectConfigService', () => {
  let svc: GradeSubjectConfigService;
  beforeEach(() => { svc = new GradeSubjectConfigService(); vi.clearAllMocks(); });

  // listForGrade
  describe('listForGrade', () => {
    it('returns ordered subject DTOs', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([mkRow()]);
      const r = await svc.listForGrade({ className: 'Grade 9', academicYear: '2026/27' });
      expect(r).toHaveLength(1);
      expect(r[0].subjectName).toBe('English');
      expect(r[0].className).toBe('Grade 9');
    });

    it('returns empty array when no configuration exists', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
      const r = await svc.listForGrade({ className: 'Grade 99', academicYear: '2026/27' });
      expect(r).toHaveLength(0);
    });

    it('queries with correct className and academicYear', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
      await svc.listForGrade({ className: 'Grade 10', academicYear: '2025/26' });
      const where = (prisma.gradeSubjectConfig.findMany as Mock).mock.calls[0][0].where;
      expect(where.className).toBe('Grade 10');
      expect(where.academicYear).toBe('2025/26');
    });
  });

  // listConfiguredGrades
  describe('listConfiguredGrades', () => {
    it('returns grouped grade summaries with subject counts', async () => {
      (prisma.gradeSubjectConfig.groupBy as Mock).mockResolvedValue([
        { className: 'Grade 9', academicYear: '2026/27', _count: { id: 5 } },
        { className: 'Grade 10', academicYear: '2026/27', _count: { id: 7 } },
      ]);
      const r = await svc.listConfiguredGrades();
      expect(r).toHaveLength(2);
      expect(r[0].subjectCount).toBe(5);
      expect(r[1].subjectCount).toBe(7);
    });

    it('returns empty array when nothing configured', async () => {
      (prisma.gradeSubjectConfig.groupBy as Mock).mockResolvedValue([]);
      const r = await svc.listConfiguredGrades();
      expect(r).toHaveLength(0);
    });
  });

  // upsert
  describe('upsert', () => {
    it('creates/updates config and returns DTO', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(SUB);
      (prisma.gradeSubjectConfig.upsert as Mock).mockResolvedValue(mkRow());
      const r = await svc.upsert(DIR, { className: 'Grade 9', academicYear: '2026/27', subjectId: 1, sortOrder: 0 });
      expect(r.subjectName).toBe('English');
      expect(prisma.gradeSubjectConfig.upsert).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when subject does not exist', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.upsert(DIR, { className: 'Grade 9', academicYear: '2026/27', subjectId: 99, sortOrder: 0 }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('TEACHER cannot upsert — ForbiddenError', async () => {
      await expect(svc.upsert(TCH, { className: 'Grade 9', academicYear: '2026/27', subjectId: 1, sortOrder: 0 }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('VICE_DIRECTOR can upsert', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(SUB);
      (prisma.gradeSubjectConfig.upsert as Mock).mockResolvedValue(mkRow());
      await expect(svc.upsert(VD, { className: 'Grade 9', academicYear: '2026/27', subjectId: 1, sortOrder: 0 }))
        .resolves.not.toThrow();
    });

    it('ADMIN can upsert', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(SUB);
      (prisma.gradeSubjectConfig.upsert as Mock).mockResolvedValue(mkRow());
      await expect(svc.upsert(ADM, { className: 'Grade 9', academicYear: '2026/27', subjectId: 1, sortOrder: 0 }))
        .resolves.not.toThrow();
    });
  });

  // remove
  describe('remove', () => {
    it('deletes existing config', async () => {
      (prisma.gradeSubjectConfig.findUnique as Mock).mockResolvedValue(mkRow());
      (prisma.gradeSubjectConfig.delete as Mock).mockResolvedValue(undefined);
      await expect(svc.remove(DIR, 1)).resolves.not.toThrow();
      expect(prisma.gradeSubjectConfig.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundError when config does not exist', async () => {
      (prisma.gradeSubjectConfig.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.remove(DIR, 999)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('TEACHER cannot remove — ForbiddenError', async () => {
      await expect(svc.remove(TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('delete NOT called when forbidden', async () => {
      await expect(svc.remove(TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.gradeSubjectConfig.delete).not.toHaveBeenCalled();
    });
  });

  // copyFromYear
  describe('copyFromYear', () => {
    it('copies subjects from source year, skips already-existing', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock)
        .mockResolvedValueOnce([{ id: 1, subjectId: 1, sortOrder: 0 }, { id: 2, subjectId: 2, sortOrder: 1 }]) // source
        .mockResolvedValueOnce([{ subjectId: 2 }]); // already in target
      (prisma.gradeSubjectConfig.createMany as Mock).mockResolvedValue({ count: 1 });

      const r = await svc.copyFromYear(DIR, { className: 'Grade 9', sourceAcademicYear: '2025/26', targetAcademicYear: '2026/27' });
      expect(r.created).toBe(1);
      expect(r.skipped).toBe(1);
    });

    it('creates all when target year has nothing', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock)
        .mockResolvedValueOnce([{ id: 1, subjectId: 1, sortOrder: 0 }])
        .mockResolvedValueOnce([]);
      (prisma.gradeSubjectConfig.createMany as Mock).mockResolvedValue({ count: 1 });
      const r = await svc.copyFromYear(DIR, { className: 'Grade 9', sourceAcademicYear: '2025/26', targetAcademicYear: '2026/27' });
      expect(r.created).toBe(1);
      expect(r.skipped).toBe(0);
    });

    it('throws NotFoundError when source year has no configuration', async () => {
      (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValueOnce([]);
      await expect(
        svc.copyFromYear(DIR, { className: 'Grade 9', sourceAcademicYear: '2020/21', targetAcademicYear: '2026/27' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('TEACHER cannot copy — ForbiddenError', async () => {
      await expect(
        svc.copyFromYear(TCH, { className: 'Grade 9', sourceAcademicYear: '2025/26', targetAcademicYear: '2026/27' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
