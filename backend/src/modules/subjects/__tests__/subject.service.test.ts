/**
 * SubjectService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma and env BEFORE importing service ──────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    subject:        { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacherSubject: { count: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { SubjectService } from '../subject.service';
import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkSubject(id = 1, code = 'ENG9', name = 'English') {
  return { subjectId: id, subjectCode: code, subjectName: name };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SubjectService', () => {
  let service: SubjectService;

  beforeEach(() => {
    service = new SubjectService();
    vi.resetAllMocks();
  });

  // ── createSubject ─────────────────────────────────────────────────────────

  describe('createSubject', () => {
    it('returns a SubjectSummaryDto on success', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(null);
      (prisma.subject.create as Mock).mockResolvedValue(mkSubject());

      const result = await service.createSubject({ subjectCode: 'ENG9', subjectName: 'English' });

      expect(prisma.subject.create).toHaveBeenCalledOnce();
      expect(result).toMatchObject({ subjectId: 1, subjectCode: 'ENG9', subjectName: 'English' });
    });

    it('throws 409 ConflictError when subjectCode already exists', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(mkSubject());

      await expect(
        service.createSubject({ subjectCode: 'ENG9', subjectName: 'English Duplicate' })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.subject.create).not.toHaveBeenCalled();
    });
  });

  // ── listSubjects ──────────────────────────────────────────────────────────

  describe('listSubjects', () => {
    it('returns items and pagination meta', async () => {
      const subjects = [mkSubject(1), mkSubject(2, 'MATH9', 'Mathematics')];
      (prisma.subject.findMany as Mock).mockResolvedValue(subjects);
      (prisma.subject.count as Mock).mockResolvedValue(2);

      const result = await service.listSubjects({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('passes search filter as OR clause to Prisma when search param provided', async () => {
      (prisma.subject.findMany as Mock).mockResolvedValue([mkSubject()]);
      (prisma.subject.count as Mock).mockResolvedValue(1);

      await service.listSubjects({ page: 1, limit: 20, search: 'Eng' });

      const findManyCall = (prisma.subject.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('OR');
      expect(findManyCall.where.OR).toHaveLength(2);

      const countCall = (prisma.subject.count as Mock).mock.calls[0][0];
      expect(countCall.where).toHaveProperty('OR');
    });

    it('passes empty where clause when no search param', async () => {
      (prisma.subject.findMany as Mock).mockResolvedValue([]);
      (prisma.subject.count as Mock).mockResolvedValue(0);

      await service.listSubjects({ page: 1, limit: 20 });

      const findManyCall = (prisma.subject.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('OR');
    });

    it('returns empty items and correct meta when no subjects exist', async () => {
      (prisma.subject.findMany as Mock).mockResolvedValue([]);
      (prisma.subject.count as Mock).mockResolvedValue(0);

      const result = await service.listSubjects({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.meta.totalItems).toBe(0);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ── getSubjectById ────────────────────────────────────────────────────────

  describe('getSubjectById', () => {
    it('returns the subject DTO when found', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(mkSubject(5, 'PHY9', 'Physics'));

      const result = await service.getSubjectById(5);

      expect(result).toMatchObject({ subjectId: 5, subjectCode: 'PHY9', subjectName: 'Physics' });
    });

    it('throws 404 NotFoundError when subject does not exist', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getSubjectById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── updateSubject ─────────────────────────────────────────────────────────

  describe('updateSubject', () => {
    it('updates and returns the DTO on success', async () => {
      const existing = mkSubject(1, 'ENG9', 'English');
      const updated  = mkSubject(1, 'ENG9', 'English Language');

      // assertExists call → findUnique resolves existing; code-conflict check → findUnique resolves same subject
      (prisma.subject.findUnique as Mock)
        .mockResolvedValueOnce(existing)   // assertExists
        .mockResolvedValueOnce(existing);  // code-conflict check (same subject → ok)
      (prisma.subject.update as Mock).mockResolvedValue(updated);

      const result = await service.updateSubject(1, { subjectName: 'English Language' });

      expect(result.subjectName).toBe('English Language');
      expect(prisma.subject.update).toHaveBeenCalledOnce();
    });

    it('throws 404 NotFoundError when subject does not exist', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.updateSubject(999, { subjectName: 'Ghost Subject' })
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.subject.update).not.toHaveBeenCalled();
    });

    it('throws 409 ConflictError when the new code is already used by a DIFFERENT subject', async () => {
      const targetSubject  = mkSubject(1, 'ENG9', 'English');
      const conflicting    = mkSubject(2, 'MATH9', 'Mathematics'); // different id

      (prisma.subject.findUnique as Mock)
        .mockResolvedValueOnce(targetSubject)   // assertExists
        .mockResolvedValueOnce(conflicting);    // code-conflict check → different id

      await expect(
        service.updateSubject(1, { subjectCode: 'MATH9' })
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.subject.update).not.toHaveBeenCalled();
    });

    it('allows updating the code to itself (same subjectId)', async () => {
      const subject = mkSubject(1, 'ENG9', 'English');

      (prisma.subject.findUnique as Mock)
        .mockResolvedValueOnce(subject)   // assertExists
        .mockResolvedValueOnce(subject);  // code-conflict check → same id → ok
      (prisma.subject.update as Mock).mockResolvedValue({ ...subject, subjectName: 'English Updated' });

      const result = await service.updateSubject(1, { subjectCode: 'ENG9', subjectName: 'English Updated' });

      expect(result.subjectId).toBe(1);
      expect(prisma.subject.update).toHaveBeenCalledOnce();
    });
  });

  // ── deleteSubject ─────────────────────────────────────────────────────────

  describe('deleteSubject', () => {
    it('deletes the subject when no teacher assignments exist', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(mkSubject(1));
      (prisma.teacherSubject.count as Mock).mockResolvedValue(0);

      await service.deleteSubject(1);

      expect(prisma.subject.delete).toHaveBeenCalledWith({ where: { subjectId: 1 } });
    });

    it('throws 409 ConflictError when the subject has existing teacher assignments', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(mkSubject(1));
      (prisma.teacherSubject.count as Mock).mockResolvedValue(3);

      await expect(service.deleteSubject(1)).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.subject.delete).not.toHaveBeenCalled();
    });

    it('throws 404 NotFoundError when subject does not exist', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(null);

      await expect(service.deleteSubject(999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.count).not.toHaveBeenCalled();
      expect(prisma.subject.delete).not.toHaveBeenCalled();
    });

    it('does NOT call delete when subject has assignments', async () => {
      (prisma.subject.findUnique as Mock).mockResolvedValue(mkSubject(1));
      (prisma.teacherSubject.count as Mock).mockResolvedValue(1);

      await expect(service.deleteSubject(1)).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.subject.delete).not.toHaveBeenCalled();
    });
  });
});
