/**
 * Phase 4.9 — AssignmentService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { SubmissionStatus } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    teacher:              { findUnique: vi.fn() },
    teacherSubject:       { findUnique: vi.fn() },
    student:              { findUnique: vi.fn(), findMany: vi.fn() },
    assignment:           { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
    assignmentSubmission: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), createMany: vi.fn() },
    $transaction:         vi.fn(),
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { AssignmentService } from '../assignment.service';
import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTOR_TCH = { userId: 10, role: 'TEACHER' as const, username: 'tch' };
const ACTOR_STU = { userId: 5,  role: 'STUDENT' as const, username: 'stu' };

const TEACHER   = { teacherId: 100, userId: 10 };
const TS        = { id: 1, teacherId: 100, subjectId: 1, classroomId: 1,
                    teacher:  { teacherId: 100, firstName: 'Tom', lastName: 'T' },
                    subject:  { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' },
                    classroom:{ classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' } };
const STU       = { studentId: 101, userId: 5, classroomId: 1,
                    firstName: 'Alice', lastName: 'A', admissionNumber: 'DSH-001' };

function mkAssignment(id = 1, tsOverride = TS) {
  return {
    assignmentId: id, title: 'HW 1', description: 'Do it',
    dueDate: new Date('2026-11-01'), createdAt: new Date(), updatedAt: new Date(),
    teacherSubject: tsOverride,
    submissions: [],
  };
}

function mkSubmission(assignmentId = 1, studentId = 101, status: SubmissionStatus = SubmissionStatus.NOT_SUBMITTED) {
  return {
    submissionId: assignmentId * 1000 + studentId, assignmentId, studentId,
    status, submittedAt: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    student: STU,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AssignmentService', () => {
  let svc: AssignmentService;
  beforeEach(() => { svc = new AssignmentService(); vi.resetAllMocks(); });

  // createAssignment
  describe('createAssignment', () => {
    it('creates assignment and seeds submission rows, returns DTO', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
      (prisma.student.findMany as Mock).mockResolvedValue([STU]);
      const created = mkAssignment();
      (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          assignment: { create: vi.fn().mockResolvedValue(created) },
          assignmentSubmission: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
        };
        return fn(tx);
      });

      const r = await svc.createAssignment(ACTOR_TCH, {
        teacherSubjectId: 1, title: 'HW 1', description: 'Do it',
        dueDate: new Date('2026-11-01'),
      });
      expect(r.assignmentId).toBe(1);
      expect(r.title).toBe('HW 1');
    });

    it('throws ForbiddenError when actor has no teacher profile', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.createAssignment(ACTOR_TCH, {
        teacherSubjectId: 1, title: 'T', description: 'D', dueDate: new Date(),
      })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws NotFoundError when TeacherSubject does not exist', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.createAssignment(ACTOR_TCH, {
        teacherSubjectId: 99, title: 'T', description: 'D', dueDate: new Date(),
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws ForbiddenError when teacher does not own the TeacherSubject', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
      (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 });
      await expect(svc.createAssignment(ACTOR_TCH, {
        teacherSubjectId: 1, title: 'T', description: 'D', dueDate: new Date(),
      })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // listForTeacherUser
  describe('listForTeacherUser', () => {
    it('returns assignments with submission summary', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      const asmt = {
        ...mkAssignment(),
        submissions: [
          { status: SubmissionStatus.SUBMITTED },
          { status: SubmissionStatus.NOT_SUBMITTED },
          { status: SubmissionStatus.LATE },
        ],
      };
      (prisma.assignment.findMany as Mock).mockResolvedValue([asmt]);

      const r = await svc.listForTeacherUser(10, {});
      expect(r).toHaveLength(1);
      expect(r[0].submissionSummary.submitted).toBe(1);
      expect(r[0].submissionSummary.late).toBe(1);
      expect(r[0].submissionSummary.notSubmitted).toBe(1);
      expect(r[0].submissionSummary.total).toBe(3);
    });

    it('throws ForbiddenError when no teacher profile', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.listForTeacherUser(99, {})).rejects.toMatchObject({ statusCode: 403 });
    });

    it('returns empty array when no assignments', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findMany as Mock).mockResolvedValue([]);
      const r = await svc.listForTeacherUser(10, {});
      expect(r).toHaveLength(0);
    });
  });

  // getSubmissions
  describe('getSubmissions', () => {
    it('returns submission DTOs for a teacher-owned assignment', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignmentSubmission.findMany as Mock).mockResolvedValue([mkSubmission()]);

      const r = await svc.getSubmissions(ACTOR_TCH, 1);
      expect(r).toHaveLength(1);
      expect(r[0].student.studentId).toBe(101);
      expect(r[0].status).toBe(SubmissionStatus.NOT_SUBMITTED);
    });

    it('throws ForbiddenError when teacher does not own assignment', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
      (prisma.assignment.findUnique as Mock).mockResolvedValue({ ...mkAssignment(), teacherSubject: { ...TS, teacherId: 999 } });
      await expect(svc.getSubmissions(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws NotFoundError when assignment does not exist', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.getSubmissions(ACTOR_TCH, 999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // updateSubmissionStatus
  describe('updateSubmissionStatus', () => {
    it('updates status and returns updated submission DTO', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(mkSubmission());
      const updated = mkSubmission(1, 101, SubmissionStatus.SUBMITTED);
      (prisma.assignmentSubmission.update as Mock).mockResolvedValue(updated);

      const r = await svc.updateSubmissionStatus(ACTOR_TCH, 1, 101, { status: SubmissionStatus.SUBMITTED });
      expect(r.status).toBe(SubmissionStatus.SUBMITTED);
    });

    it('throws NotFoundError when submission record does not exist', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(null);
      await expect(
        svc.updateSubmissionStatus(ACTOR_TCH, 1, 999, { status: SubmissionStatus.SUBMITTED })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // deleteAssignment
  describe('deleteAssignment', () => {
    it('deletes an owned assignment', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignment.delete as Mock).mockResolvedValue(undefined);

      await expect(svc.deleteAssignment(ACTOR_TCH, 1)).resolves.not.toThrow();
      expect(prisma.assignment.delete).toHaveBeenCalledWith({ where: { assignmentId: 1 } });
    });

    it('throws ForbiddenError when teacher does not own assignment', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.assignment.findUnique as Mock).mockResolvedValue({ ...mkAssignment(), teacherSubject: { ...TS, teacherId: 999 } });
      await expect(svc.deleteAssignment(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.assignment.delete).not.toHaveBeenCalled();
    });
  });

  // listForStudentUser
  describe('listForStudentUser', () => {
    it('returns assignments with student\'s own submission status', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      const asmt = {
        ...mkAssignment(),
        submissions: [{ ...mkSubmission(1, 101, SubmissionStatus.SUBMITTED), submittedAt: new Date() }],
      };
      (prisma.assignment.findMany as Mock).mockResolvedValue([asmt]);

      const r = await svc.listForStudentUser(5);
      expect(r).toHaveLength(1);
      expect(r[0].mySubmission.status).toBe(SubmissionStatus.SUBMITTED);
    });

    it('defaults mySubmission.status to NOT_SUBMITTED when no submission row', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      const asmt = { ...mkAssignment(), submissions: [] }; // no submission yet
      (prisma.assignment.findMany as Mock).mockResolvedValue([asmt]);

      const r = await svc.listForStudentUser(5);
      expect(r[0].mySubmission.status).toBe(SubmissionStatus.NOT_SUBMITTED);
    });

    it('throws ForbiddenError when userId has no student profile', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.listForStudentUser(99)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // markMySubmission
  describe('markMySubmission', () => {
    it('marks submission as SUBMITTED (before due date)', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      // Future due date → SUBMITTED
      (prisma.assignment.findUnique as Mock).mockResolvedValue({
        ...mkAssignment(), dueDate: new Date('2099-12-31'),
      });
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(mkSubmission());
      const updated = mkSubmission(1, 101, SubmissionStatus.SUBMITTED);
      (prisma.assignmentSubmission.update as Mock).mockResolvedValue(updated);

      const r = await svc.markMySubmission(5, 1, { submitted: true });
      expect(r.status).toBe(SubmissionStatus.SUBMITTED);
    });

    it('marks submission as LATE (past due date)', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      // Past due date → LATE
      (prisma.assignment.findUnique as Mock).mockResolvedValue({
        ...mkAssignment(), dueDate: new Date('2020-01-01'),
      });
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(mkSubmission());
      const updated = mkSubmission(1, 101, SubmissionStatus.LATE);
      (prisma.assignmentSubmission.update as Mock).mockResolvedValue(updated);

      const r = await svc.markMySubmission(5, 1, { submitted: true });
      expect(r.status).toBe(SubmissionStatus.LATE);
    });

    it('marks submission as NOT_SUBMITTED when submitted=false', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(mkSubmission());
      const updated = mkSubmission(1, 101, SubmissionStatus.NOT_SUBMITTED);
      (prisma.assignmentSubmission.update as Mock).mockResolvedValue(updated);

      const r = await svc.markMySubmission(5, 1, { submitted: false });
      expect(r.status).toBe(SubmissionStatus.NOT_SUBMITTED);
    });

    it('throws ForbiddenError when no student profile', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.markMySubmission(99, 1, { submitted: true })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws NotFoundError when assignment does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.markMySubmission(5, 999, { submitted: true })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws NotFoundError when submission record does not exist', async () => {
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.assignment.findUnique as Mock).mockResolvedValue(mkAssignment());
      (prisma.assignmentSubmission.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.markMySubmission(5, 1, { submitted: true })).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
