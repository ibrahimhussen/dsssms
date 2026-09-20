/**
 * Phase 4.8 — ClassroomService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ClassroomService } from '../classroom.service';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacher:   { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

const TEACHER = { teacherId: 1, firstName: 'T', lastName: 'T' };

function mkCl(id = 1, studentCount = 0) {
  return {
    classroomId: id, className: 'Grade 9', section: 'A', academicYear: '2026/27',
    session: 'MORNING', homeroomTeacherId: null, homeroomTeacher: null,
    _count: { students: studentCount },
  };
}

describe('ClassroomService', () => {
  let svc: ClassroomService;
  beforeEach(() => { svc = new ClassroomService(); vi.clearAllMocks(); });

  // createClassroom
  describe('createClassroom', () => {
    it('creates and returns a classroom DTO', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null); // no duplicate
      (prisma.classroom.create as Mock).mockResolvedValue(mkCl());
      const r = await svc.createClassroom({ className: 'Grade 9', section: 'A', academicYear: '2026/27', session: 'MORNING' });
      expect(r.classroomId).toBe(1);
      expect(r.className).toBe('Grade 9');
      expect(r.studentCount).toBe(0);
    });

    it('throws ConflictError when classroom already exists', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl());
      await expect(svc.createClassroom({ className: 'Grade 9', section: 'A', academicYear: '2026/27', session: 'MORNING' }))
        .rejects.toMatchObject({ statusCode: 409 });
    });

    it('validates homeroom teacher exists when provided', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null); // teacher not found
      await expect(svc.createClassroom({ className: 'Grade 9', section: 'A', academicYear: '2026/27', session: 'MORNING', homeroomTeacherId: 99 }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('creates with homeroom teacher when teacher exists', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.classroom.create as Mock).mockResolvedValue({ ...mkCl(), homeroomTeacherId: 1, homeroomTeacher: TEACHER });
      const r = await svc.createClassroom({ className: 'Grade 9', section: 'A', academicYear: '2026/27', session: 'MORNING', homeroomTeacherId: 1 });
      expect(r.homeroomTeacher?.teacherId).toBe(1);
    });
  });

  // listClassrooms
  describe('listClassrooms', () => {
    it('returns items and meta', async () => {
      (prisma.classroom.findMany as Mock).mockResolvedValue([mkCl()]);
      (prisma.classroom.count as Mock).mockResolvedValue(1);
      const r = await svc.listClassrooms({ page: 1, limit: 20 });
      expect(r.items).toHaveLength(1);
      expect(r.meta.totalItems).toBe(1);
    });

    it('filters by academicYear when provided', async () => {
      (prisma.classroom.findMany as Mock).mockResolvedValue([]);
      (prisma.classroom.count as Mock).mockResolvedValue(0);
      await svc.listClassrooms({ page: 1, limit: 10, academicYear: '2026/27' });
      const where = (prisma.classroom.findMany as Mock).mock.calls[0][0].where;
      expect(where.academicYear).toBe('2026/27');
    });

    it('includes search filter when provided', async () => {
      (prisma.classroom.findMany as Mock).mockResolvedValue([]);
      (prisma.classroom.count as Mock).mockResolvedValue(0);
      await svc.listClassrooms({ page: 1, limit: 10, search: 'Grade 9' });
      const where = (prisma.classroom.findMany as Mock).mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  // getClassroomById
  describe('getClassroomById', () => {
    it('returns DTO when found', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl(5, 30));
      const r = await svc.getClassroomById(5);
      expect(r.classroomId).toBe(5);
      expect(r.studentCount).toBe(30);
    });

    it('throws NotFoundError when classroom does not exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.getClassroomById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // updateClassroom
  describe('updateClassroom', () => {
    it('updates and returns DTO', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl()); // assertExists
      (prisma.classroom.update as Mock).mockResolvedValue(mkCl());
      const r = await svc.updateClassroom(1, { section: 'B' });
      expect(r.classroomId).toBe(1);
      expect(prisma.classroom.update).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when classroom does not exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.updateClassroom(999, { section: 'B' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('validates homeroom teacher when provided in update', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl());
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.updateClassroom(1, { homeroomTeacherId: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // deleteClassroom
  describe('deleteClassroom', () => {
    it('deletes classroom with no students', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl(1, 0));
      (prisma.classroom.delete as Mock).mockResolvedValue(undefined);
      await expect(svc.deleteClassroom(1)).resolves.not.toThrow();
      expect(prisma.classroom.delete).toHaveBeenCalledWith({ where: { classroomId: 1 } });
    });

    it('throws ConflictError when classroom has enrolled students', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl(1, 5)); // 5 students
      await expect(svc.deleteClassroom(1)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws NotFoundError when classroom does not exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.deleteClassroom(999)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('delete NOT called when students are enrolled', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(mkCl(1, 3));
      await expect(svc.deleteClassroom(1)).rejects.toMatchObject({ statusCode: 409 });
      expect(prisma.classroom.delete).not.toHaveBeenCalled();
    });
  });
});
