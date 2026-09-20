/**
 * Phase 4.8 — TimetableService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { TimetableService } from '../timetable.service';
import { Semester } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    teacherSubject:  { findUnique: vi.fn(), findMany: vi.fn() },
    timetableEntry:  { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    teacher:         { findUnique: vi.fn() },
    student:         { findUnique: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

const TS = {
  id: 1, teacherId: 100, subjectId: 1, classroomId: 1,
  teacher: { teacherId: 100, firstName: 'Tom', lastName: 'T' },
  subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' },
  classroom: { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
};

function mkEntry(id = 1, period = 1, teacherSubject = TS) {
  return {
    timetableEntryId: id, semester: Semester.SEMESTER_1, dayOfWeek: 'MONDAY',
    period, startTime: '08:00', endTime: '09:00', roomNumber: '101',
    status: 'DRAFT', teacherSubject,
  };
}

const BASE_INPUT = {
  teacherSubjectId: 1, semester: Semester.SEMESTER_1,
  dayOfWeek: 'MONDAY' as const, period: 1,
  startTime: '08:00', endTime: '09:00',
};

describe('TimetableService', () => {
  let svc: TimetableService;
  beforeEach(() => { svc = new TimetableService(); vi.clearAllMocks(); });

  // createEntry
  describe('createEntry', () => {
    it('creates an entry when no conflicts exist', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1, teacherId: 100, classroomId: 1 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([]); // no conflicts
      (prisma.timetableEntry.create as Mock).mockResolvedValue(mkEntry());
      const r = await svc.createEntry(BASE_INPUT);
      expect(r.timetableEntryId).toBe(1);
      expect(r.dayOfWeek).toBe('MONDAY');
      expect(prisma.timetableEntry.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when TeacherSubject does not exist', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.createEntry(BASE_INPUT)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws ConflictError when teacher has same period on same day', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1, teacherId: 100, classroomId: 1 }]);
      // Existing entry with same period, same teacher
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([
        mkEntry(99, 1, { ...TS, id: 1 }), // period=1, same teacher
      ]);
      await expect(svc.createEntry(BASE_INPUT)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('throws ConflictError when classroom already has same period on same day', async () => {
      // Different teacher, same classroom, same period
      const TS2 = { ...TS, id: 2, teacherId: 200 };
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
        { id: 1, teacherId: 100, classroomId: 1 },
        { id: 2, teacherId: 200, classroomId: 1 },
      ]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([
        mkEntry(99, 1, TS2), // same period, different teacher, same classroom
      ]);
      await expect(svc.createEntry(BASE_INPUT)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('allows different period on same day (no conflict)', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1, teacherId: 100, classroomId: 1 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([mkEntry(99, 2)]); // period 2, not 1
      (prisma.timetableEntry.create as Mock).mockResolvedValue(mkEntry(2, 1));
      await expect(svc.createEntry(BASE_INPUT)).resolves.not.toThrow();
    });
  });

  // deleteEntry
  describe('deleteEntry', () => {
    it('deletes an existing entry', async () => {
      (prisma.timetableEntry.findUnique as Mock).mockResolvedValue(mkEntry());
      (prisma.timetableEntry.delete as Mock).mockResolvedValue(undefined);
      await expect(svc.deleteEntry(1)).resolves.not.toThrow();
      expect(prisma.timetableEntry.delete).toHaveBeenCalledWith({ where: { timetableEntryId: 1 } });
    });

    it('throws NotFoundError when entry does not exist', async () => {
      (prisma.timetableEntry.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.deleteEntry(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // publishEntry
  describe('publishEntry', () => {
    it('publishes a DRAFT entry', async () => {
      (prisma.timetableEntry.findUnique as Mock).mockResolvedValue(mkEntry());
      (prisma.timetableEntry.update as Mock).mockResolvedValue({ ...mkEntry(), status: 'PUBLISHED' });
      const r = await svc.publishEntry(1);
      expect(r.status).toBe('PUBLISHED');
      expect(prisma.timetableEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PUBLISHED' } })
      );
    });

    it('throws NotFoundError when entry does not exist', async () => {
      (prisma.timetableEntry.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.publishEntry(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // listEntries
  describe('listEntries', () => {
    it('returns sorted entries', async () => {
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([
        mkEntry(2, 2), mkEntry(1, 1),
      ]);
      const r = await svc.listEntries({});
      expect(r[0].period).toBe(1); // sorted by day then period
      expect(r[1].period).toBe(2);
    });

    it('filters by classroomId — fetches teacherSubjectIds first', async () => {
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([]);
      await svc.listEntries({ classroomId: 1 });
      const where = (prisma.timetableEntry.findMany as Mock).mock.calls[0][0].where;
      expect(where.teacherSubjectId.in).toEqual([1, 2]);
    });

    it('filters by semester when provided', async () => {
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([]);
      await svc.listEntries({ semester: Semester.SEMESTER_2 });
      const where = (prisma.timetableEntry.findMany as Mock).mock.calls[0][0].where;
      expect(where.semester).toBe(Semester.SEMESTER_2);
    });
  });

  // listForTeacherUser
  describe('listForTeacherUser', () => {
    it('returns teacher schedule sorted by day then period', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 100, userId: 10 });
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([mkEntry(1, 1)]);
      const r = await svc.listForTeacherUser(10);
      expect(r).toHaveLength(1);
      expect(r[0].timetableEntryId).toBe(1);
    });

    it('throws ForbiddenError when userId has no teacher profile', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.listForTeacherUser(99)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('filters by semester when provided', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 100 });
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([]);
      await svc.listForTeacherUser(10, Semester.SEMESTER_1);
      const where = (prisma.timetableEntry.findMany as Mock).mock.calls[0][0].where;
      expect(where.semester).toBe(Semester.SEMESTER_1);
    });
  });

  // listForStudentUser
  describe('listForStudentUser', () => {
    it('returns student classroom schedule', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue({ studentId: 101, classroomId: 1, userId: 5 });
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 1 }]);
      (prisma.timetableEntry.findMany as Mock).mockResolvedValue([mkEntry()]);
      const r = await svc.listForStudentUser(5);
      expect(r).toHaveLength(1);
    });

    it('throws ForbiddenError when userId has no student profile', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.listForStudentUser(99)).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
