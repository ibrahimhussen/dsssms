/**
 * StudentService Unit Tests
 *
 * DATABASE SAFETY: all Prisma calls are mocked — no real DB connection required.
 *
 * NOTE: createStudent is NOT tested here — it uses $transaction + generateStudentId
 * with a row-locked StudentIdCounter, which is too complex to mock cleanly.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock Prisma, env, and parentService BEFORE importing service ──────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:         { findUnique: vi.fn() },
    student:           { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    studentParentLink: { findUnique: vi.fn(), delete: vi.fn() },
    studentEnrollment: { findMany: vi.fn() },
    teacher:           { findUnique: vi.fn() },
    teacherSubject:    { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

// parentService is imported inside student.service.ts — mock its resolved path
vi.mock('../../parents/parent.service', () => ({
  parentService: { createParent: vi.fn() },
}));

import { StudentService } from '../student.service';
import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function mkStudent(id = 101) {
  return {
    studentId:                id,
    userId:                   200 + id,
    classroomId:              1,
    admissionNumber:          `DSH-00${id}`,
    firstName:                'Alice',
    lastName:                 'A',
    gender:                   'F',
    dateOfBirth:              new Date('2010-01-15'),
    address:                  null,
    enrolledAt:               new Date(),
    admissionType:            'NEW_STUDENT',
    studentStatus:            'ACTIVE',
    completionYear:           null,
    lastGradeCompleted:       null,
    previousAcademicSummary:  null,
    previousSchoolLocation:   null,
    previousSchoolName:       null,
    previousSchoolType:       null,
    previousStudentId:        null,
    transferReason:           null,
    transferCertificateRef:   null,
    transferredOutAt:         null,
    transferredOutDestination: null,
    transferredOutReason:     null,
    classroom: { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
    user:      { userId: 200 + id, username: `DSH-00${id}` },
    parentLinks: [],
  };
}

function mkClassroom(classroomId = 1) {
  return { classroomId, className: 'Grade 9', section: 'A', academicYear: '2026/27' };
}

function mkTeacher(teacherId = 50, userId = 5) {
  return { teacherId, userId, firstName: 'Mr', lastName: 'Teacher' };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StudentService', () => {
  let service: StudentService;

  beforeEach(() => {
    service = new StudentService();
    vi.resetAllMocks();
  });

  // ── transferOutStudent ────────────────────────────────────────────────────

  describe('transferOutStudent', () => {
    it('marks the student as TRANSFERRED_OUT and returns the updated DTO', async () => {
      const student = mkStudent();
      const transferredStudent = { ...student, studentStatus: 'TRANSFERRED_OUT', transferredOutAt: new Date() };
      (prisma.student.findUnique as Mock).mockResolvedValue(student);
      (prisma.student.update    as Mock).mockResolvedValue(transferredStudent);

      const result = await service.transferOutStudent(101, {
        transferredOutDestination: 'City School',
        transferredOutReason:      'Family relocation',
      });

      expect(prisma.student.update).toHaveBeenCalledOnce();
      const updateCall = (prisma.student.update as Mock).mock.calls[0][0];
      expect(updateCall.data.studentStatus).toBe('TRANSFERRED_OUT');
      expect(result.studentStatus).toBe('TRANSFERRED_OUT');
    });

    it('throws 404 NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.transferOutStudent(999, {})
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.student.update).not.toHaveBeenCalled();
    });
  });

  // ── listStudents ──────────────────────────────────────────────────────────

  describe('listStudents', () => {
    it('returns items and pagination meta', async () => {
      const students = [mkStudent(101), mkStudent(102)];
      (prisma.student.findMany as Mock).mockResolvedValue(students);
      (prisma.student.count   as Mock).mockResolvedValue(2);

      const result = await service.listStudents({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);
    });

    it('filters by classroomId when provided', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([mkStudent()]);
      (prisma.student.count   as Mock).mockResolvedValue(1);

      await service.listStudents({ page: 1, limit: 20, classroomId: 1 });

      const findManyCall = (prisma.student.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ classroomId: 1 });
    });

    it('applies search OR filter when search is provided', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([]);
      (prisma.student.count   as Mock).mockResolvedValue(0);

      await service.listStudents({ page: 1, limit: 20, search: 'Alice' });

      const findManyCall = (prisma.student.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toHaveProperty('OR');
    });

    it('returns empty result set correctly', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([]);
      (prisma.student.count   as Mock).mockResolvedValue(0);

      const result = await service.listStudents({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(0);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  // ── exportStudents ────────────────────────────────────────────────────────

  describe('exportStudents', () => {
    it('returns an array of StudentSummaryDto (not paginated)', async () => {
      const students = [mkStudent(101), mkStudent(102), mkStudent(103)];
      (prisma.student.findMany as Mock).mockResolvedValue(students);

      const result = await service.exportStudents({});

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    it('filters by classroomId when provided', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([mkStudent()]);

      await service.exportStudents({ classroomId: 1 });

      const findManyCall = (prisma.student.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ classroomId: 1 });
    });

    it('does not include pagination (no skip/take passed to findMany)', async () => {
      (prisma.student.findMany as Mock).mockResolvedValue([]);

      await service.exportStudents({});

      const findManyCall = (prisma.student.findMany as Mock).mock.calls[0][0];
      expect(findManyCall).not.toHaveProperty('skip');
      // take=5000 is the export cap, not a page limit
    });
  });

  // ── getStudentById ────────────────────────────────────────────────────────

  describe('getStudentById', () => {
    it('returns StudentSummaryDto when student exists', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(mkStudent(101));

      const result = await service.getStudentById(101);

      expect(result).toMatchObject({
        studentId:       101,
        admissionNumber: 'DSH-00101',
        firstName:       'Alice',
      });
    });

    it('throws 404 NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getStudentById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── getStudentByUserId ────────────────────────────────────────────────────

  describe('getStudentByUserId', () => {
    it('returns StudentSummaryDto for the given userId', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(mkStudent(101));

      const result = await service.getStudentByUserId(301);

      expect(result.studentId).toBe(101);
    });

    it('throws 404 NotFoundError when no student exists for the userId', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getStudentByUserId(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── updateStudent ─────────────────────────────────────────────────────────

  describe('updateStudent', () => {
    it('updates and returns the updated StudentSummaryDto', async () => {
      const student = mkStudent();
      const updated = { ...student, firstName: 'Alicia' };
      (prisma.student.findUnique as Mock).mockResolvedValue(student); // assertExists
      (prisma.student.update    as Mock).mockResolvedValue(updated);

      const result = await service.updateStudent(101, { firstName: 'Alicia' });

      expect(result.firstName).toBe('Alicia');
      expect(prisma.student.update).toHaveBeenCalledOnce();
    });

    it('throws 404 NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(service.updateStudent(999, { firstName: 'Ghost' })).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.student.update).not.toHaveBeenCalled();
    });
  });

  // ── transferClassroom ─────────────────────────────────────────────────────

  describe('transferClassroom', () => {
    it('transfers the student to the new classroom and returns the updated DTO', async () => {
      const student   = mkStudent();
      const classroom = mkClassroom(2);
      const updated   = { ...student, classroomId: 2, classroom: { ...classroom } };
      (prisma.student.findUnique   as Mock).mockResolvedValue(student);   // assertExists
      (prisma.classroom.findUnique as Mock).mockResolvedValue(classroom);
      (prisma.student.update       as Mock).mockResolvedValue(updated);

      const result = await service.transferClassroom(101, 2);

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { classroomId: 2 } })
      );
      expect(result.classroom.classroomId).toBe(2);
    });

    it('throws 404 NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(service.transferClassroom(999, 2)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.classroom.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 NotFoundError when the target classroom does not exist', async () => {
      (prisma.student.findUnique   as Mock).mockResolvedValue(mkStudent());
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);

      await expect(service.transferClassroom(101, 999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.student.update).not.toHaveBeenCalled();
    });
  });

  // ── removeParentLink ──────────────────────────────────────────────────────

  describe('removeParentLink', () => {
    it('deletes the link when it exists', async () => {
      const link = { id: 55, studentId: 101, parentId: 10 };
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(link);

      await service.removeParentLink(101, 10);

      expect(prisma.studentParentLink.delete).toHaveBeenCalledWith({ where: { id: 55 } });
    });

    it('throws 404 NotFoundError when the link does not exist', async () => {
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(null);

      await expect(service.removeParentLink(101, 999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.studentParentLink.delete).not.toHaveBeenCalled();
    });

    it('calls delete with the link id (not studentId/parentId directly)', async () => {
      const link = { id: 77, studentId: 101, parentId: 20 };
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(link);

      await service.removeParentLink(101, 20);

      const deleteCall = (prisma.studentParentLink.delete as Mock).mock.calls[0][0];
      expect(deleteCall.where).toEqual({ id: 77 });
    });
  });

  // ── getEnrollmentHistory ──────────────────────────────────────────────────

  describe('getEnrollmentHistory', () => {
    it('returns ordered enrollment history for the student', async () => {
      const student = mkStudent();
      const enrollments = [
        {
          id: 1, studentId: 101, classroomId: 1, academicYear: '2024/25',
          decision: 'ACTIVE', batchId: null, notes: null,
          createdAt: new Date('2024-09-01'),
          classroom: mkClassroom(1),
        },
        {
          id: 2, studentId: 101, classroomId: 1, academicYear: '2025/26',
          decision: 'PROMOTED', batchId: null, notes: null,
          createdAt: new Date('2025-09-01'),
          classroom: mkClassroom(1),
        },
      ];
      (prisma.student.findUnique         as Mock).mockResolvedValue(student);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue(enrollments);

      const result = await service.getEnrollmentHistory(101);

      expect(result).toHaveLength(2);
      expect(result[0].academicYear).toBe('2024/25');
      expect(result[1].academicYear).toBe('2025/26');
      expect(typeof result[0].createdAt).toBe('string'); // toISOString() called
    });

    it('throws 404 NotFoundError when student does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);

      await expect(service.getEnrollmentHistory(999)).rejects.toMatchObject({ statusCode: 404 });

      expect(prisma.studentEnrollment.findMany).not.toHaveBeenCalled();
    });
  });

  // ── assertTeacherOwnsClassroom ────────────────────────────────────────────

  describe('assertTeacherOwnsClassroom', () => {
    it('resolves without error when the teacher is assigned to the classroom', async () => {
      (prisma.teacher.findUnique       as Mock).mockResolvedValue(mkTeacher());
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue({ id: 1, teacherId: 50, classroomId: 1 });

      await expect(service.assertTeacherOwnsClassroom(5, 1)).resolves.toBeUndefined();
    });

    it('throws 403 ForbiddenError when teacher has no assignment to the classroom', async () => {
      (prisma.teacher.findUnique       as Mock).mockResolvedValue(mkTeacher());
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null);

      await expect(service.assertTeacherOwnsClassroom(5, 1)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws 403 ForbiddenError when the userId has no teacher profile', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);

      await expect(service.assertTeacherOwnsClassroom(999, 1)).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.teacherSubject.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── listStudentsForTeacher ────────────────────────────────────────────────

  describe('listStudentsForTeacher', () => {
    it("returns students from all the teacher's assigned classrooms", async () => {
      const teacher = mkTeacher();
      const assignments = [{ classroomId: 1 }, { classroomId: 2 }];
      const students = [mkStudent(101), mkStudent(102)];

      (prisma.teacher.findUnique       as Mock).mockResolvedValue(teacher);
      (prisma.teacherSubject.findMany  as Mock).mockResolvedValue(assignments);
      (prisma.student.findMany         as Mock).mockResolvedValue(students);
      (prisma.student.count            as Mock).mockResolvedValue(2);

      const result = await service.listStudentsForTeacher(5, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta.totalItems).toBe(2);

      // The inner listStudents call should filter by classroomIds array
      const findManyCall = (prisma.student.findMany as Mock).mock.calls[0][0];
      expect(findManyCall.where).toMatchObject({ classroomId: { in: [1, 2] } });
    });

    it('throws 403 ForbiddenError when no teacher profile exists for the userId', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);

      await expect(
        service.listStudentsForTeacher(999, { page: 1, limit: 20 })
      ).rejects.toMatchObject({ statusCode: 403 });

      expect(prisma.teacherSubject.findMany).not.toHaveBeenCalled();
    });

    it('returns empty result when the teacher has no classroom assignments', async () => {
      (prisma.teacher.findUnique      as Mock).mockResolvedValue(mkTeacher());
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]); // no assignments

      const result = await service.listStudentsForTeacher(5, { page: 1, limit: 20 });

      expect(result.items).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });
  });
});
