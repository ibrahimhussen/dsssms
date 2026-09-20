/**
 * TeacherSubjectService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma and env BEFORE importing service ──────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    teacher:        { findUnique: vi.fn() },
    subject:        { findUnique: vi.fn() },
    classroom:      { findUnique: vi.fn() },
    teacherSubject: {
      findUnique: vi.fn(),
      findFirst:  vi.fn(),
      findMany:   vi.fn(),
      count:      vi.fn(),
      create:     vi.fn(),
      delete:     vi.fn(),
    },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { TeacherSubjectService } from '../teacher-subject.service';
import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEACHER = { teacherId: 10, firstName: 'Abebe', lastName: 'Kebede', userId: 5 };
const SUBJECT = { subjectId: 1, subjectCode: 'MATH9', subjectName: 'Mathematics' };
const CLASSROOM = { classroomId: 3, className: 'Grade 9', section: 'A', academicYear: '2026/27' };

function mkAssignment(id = 100) {
  return {
    id,
    teacherId:   TEACHER.teacherId,
    subjectId:   SUBJECT.subjectId,
    classroomId: CLASSROOM.classroomId,
    teacher:     TEACHER,
    subject:     SUBJECT,
    classroom:   CLASSROOM,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TeacherSubjectService', () => {
  let service: TeacherSubjectService;

  beforeEach(() => {
    service = new TeacherSubjectService();
    vi.resetAllMocks();
  });

  // ── createAssignment ──────────────────────────────────────────────────────

  describe('createAssignment', () => {
    const input = {
      teacherId:   TEACHER.teacherId,
      subjectId:   SUBJECT.subjectId,
      classroomId: CLASSROOM.classroomId,
    };

    it('returns TeacherSubjectAssignmentDto on success', async () => {
      (prisma.teacher.findUnique   as Mock).mockResolvedValue(TEACHER);
      (prisma.subject.findUnique   as Mock).mockResolvedValue(SUBJECT);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null); // no duplicate
      (prisma.teacherSubject.create as Mock).mockResolvedValue(mkAssignment());

      const result = await service.createAssignment(input);

      expect(prisma.teacherSubject.create).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        id: 100,
        teacher:   { teacherId: 10, firstName: 'Abebe', lastName: 'Kebede' },
        subject:   { subjectId: 1,  subjectCode: 'MATH9', subjectName: 'Mathematics' },
        classroom: { classroomId: 3, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
      });
    });

    it('throws 404 NotFoundError when teacher does not exist', async () => {
      (prisma.teacher.findUnique   as Mock).mockResolvedValue(null);
      (prisma.subject.findUnique   as Mock).mockResolvedValue(SUBJECT);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);

      await expect(service.createAssignment(input)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.create).not.toHaveBeenCalled();
    });

    it('throws 404 NotFoundError when subject does not exist', async () => {
      (prisma.teacher.findUnique   as Mock).mockResolvedValue(TEACHER);
      (prisma.subject.findUnique   as Mock).mockResolvedValue(null);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);

      await expect(service.createAssignment(input)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.create).not.toHaveBeenCalled();
    });

    it('throws 404 NotFoundError when classroom does not exist', async () => {
      (prisma.teacher.findUnique   as Mock).mockResolvedValue(TEACHER);
      (prisma.subject.findUnique   as Mock).mockResolvedValue(SUBJECT);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);

      await expect(service.createAssignment(input)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.create).not.toHaveBeenCalled();
    });

    it('throws 409 ConflictError when the exact assignment already exists', async () => {
      (prisma.teacher.findUnique   as Mock).mockResolvedValue(TEACHER);
      (prisma.subject.findUnique   as Mock).mockResolvedValue(SUBJECT);
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM);
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(mkAssignment()); // duplicate

      await expect(service.createAssignment(input)).rejects.toMatchObject({ statusCode: 409 });

      expect(prisma.teacherSubject.create).not.toHaveBeenCalled();
    });
  });

  // ── listAssignments ───────────────────────────────────────────────────────

  describe('listAssignments', () => {
    it('returns items and pagination meta', async () => {
      const assignments = [mkAssignment(1), mkAssignment(2)];
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue(assignments);
      (prisma.teacherSubject.count   as Mock).mockResolvedValue(2);

      const result = await service.listAssignments({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });

    it('filters by teacherId when provided', async () => {
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([mkAssignment()]);
      (prisma.teacherSubject.count   as Mock).mockResolvedValue(1);

      await service.listAssignments({ page: 1, limit: 20, teacherId: 10 });

      const findManyCall = (prisma.teacherSubject.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ teacherId: 10 });
    });

    it('filters by classroomId when provided', async () => {
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([mkAssignment()]);
      (prisma.teacherSubject.count   as Mock).mockResolvedValue(1);

      await service.listAssignments({ page: 1, limit: 20, classroomId: 3 });

      const findManyCall = (prisma.teacherSubject.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ classroomId: 3 });
    });

    it('does not include filter keys in where when not provided', async () => {
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
      (prisma.teacherSubject.count   as Mock).mockResolvedValue(0);

      await service.listAssignments({ page: 1, limit: 20 });

      const findManyCall = (prisma.teacherSubject.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('teacherId');
      expect(findManyCall.where).not.toHaveProperty('classroomId');
    });
  });

  // ── listAssignmentsForTeacherUser ─────────────────────────────────────────

  describe('listAssignmentsForTeacherUser', () => {
    it('returns assignments mapped to DTOs for the authenticated teacher', async () => {
      (prisma.teacher.findUnique     as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([mkAssignment()]);

      const result = await service.listAssignmentsForTeacherUser(5);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 100 });
    });

    it('throws 404 NotFoundError when no teacher profile exists for the userId', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);

      await expect(service.listAssignmentsForTeacherUser(999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.findMany).not.toHaveBeenCalled();
    });
  });

  // ── deleteAssignment ──────────────────────────────────────────────────────

  describe('deleteAssignment', () => {
    it('deletes the assignment when found', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(mkAssignment());

      await service.deleteAssignment(100);

      expect(prisma.teacherSubject.delete).toHaveBeenCalledWith({ where: { id: 100 } });
    });

    it('throws 404 NotFoundError when assignment does not exist', async () => {
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null);

      await expect(service.deleteAssignment(999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.teacherSubject.delete).not.toHaveBeenCalled();
    });
  });

  // ── assertTeacherAssignedToClassroom ──────────────────────────────────────

  describe('assertTeacherAssignedToClassroom', () => {
    it('resolves without error when an assignment exists', async () => {
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(mkAssignment());

      await expect(
        service.assertTeacherAssignedToClassroom({ teacherId: 10, classroomId: 3 })
      ).resolves.toBeUndefined();
    });

    it('throws 404 NotFoundError when no assignment exists', async () => {
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null);

      await expect(
        service.assertTeacherAssignedToClassroom({ teacherId: 10, classroomId: 3 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('passes subjectId to the findFirst where clause when provided', async () => {
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(mkAssignment());

      await service.assertTeacherAssignedToClassroom({ teacherId: 10, classroomId: 3, subjectId: 1 });

      const call = (prisma.teacherSubject.findFirst as Mock).mock.calls[0][0];
      expect(call.where).toMatchObject({ subjectId: 1 });
    });
  });
});
