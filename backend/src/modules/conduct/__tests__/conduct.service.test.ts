/**
 * Phase 4.8 — ConductService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { ConductService } from '../conduct.service';
import { ConductRating, Semester } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:      { findUnique: vi.fn() },
    student:        { findUnique: vi.fn(), count: vi.fn() },
    studentConduct: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn() },
    studentParentLink: { findMany: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));

import { prisma } from '../../../database/prisma-client';

const DIR  = { userId: 1, role: 'DIRECTOR'      as const, username: 'dir' };
const VD   = { userId: 2, role: 'VICE_DIRECTOR'  as const, username: 'vd'  };
const ADM  = { userId: 3, role: 'ADMIN'          as const, username: 'adm' };
const TCH  = { userId: 4, role: 'TEACHER'        as const, username: 'tch' };
const STU_ACTOR = { userId: 201, role: 'STUDENT' as const, username: 'stu' };
const PAR_ACTOR = { userId: 300, role: 'PARENT'  as const, username: 'par' };

const CL = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' };
const STU = { studentId: 101, classroomId: 1, userId: 201, firstName: 'Alice', lastName: 'A', admissionNumber: 'DSH-001', classroom: CL };
const ASSIGNED_BY = { username: 'dir', director: { firstName: 'Dave', lastName: 'D' }, viceDirector: null, administrator: null };

function mkConduct(id = 1, rating: ConductRating = ConductRating.GOOD) {
  return {
    id, studentId: 101, classroomId: 1, academicYear: '2026/27',
    semester: Semester.SEMESTER_1, rating,
    assignedBy: 1, assignedAt: new Date(), notes: null, updatedAt: new Date(),
    student: STU, classroom: CL, assignedByUser: ASSIGNED_BY,
  };
}

describe('ConductService', () => {
  let svc: ConductService;
  beforeEach(() => { svc = new ConductService(); vi.clearAllMocks(); });

  // upsertConduct
  describe('upsertConduct', () => {
    it('creates or updates conduct and returns detail DTO', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.studentConduct.upsert as Mock).mockResolvedValue(mkConduct());
      const r = await svc.upsertConduct(DIR, {
        studentId: 101, classroomId: 1, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.GOOD,
      });
      expect(r.rating).toBe(ConductRating.GOOD);
      expect(r.studentName).toBe('Alice A');
      expect(r.assignedByName).toBe('Dave D');
    });

    it('TEACHER cannot upsert conduct — ForbiddenError', async () => {
      await expect(svc.upsertConduct(TCH, {
        studentId: 101, classroomId: 1, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.GOOD,
      })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('ADMIN cannot upsert conduct — ForbiddenError (Admin is technical role)', async () => {
      await expect(svc.upsertConduct(ADM, {
        studentId: 101, classroomId: 1, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.GOOD,
      })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws NotFoundError when classroom does not exist', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.upsertConduct(DIR, {
        studentId: 101, classroomId: 999, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.GOOD,
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws BadRequestError when student is not in the classroom', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.student.findUnique as Mock).mockResolvedValue({ ...STU, classroomId: 99 }); // wrong classroom
      await expect(svc.upsertConduct(DIR, {
        studentId: 101, classroomId: 1, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.GOOD,
      })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('VD can upsert conduct', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.student.findUnique as Mock).mockResolvedValue(STU);
      (prisma.studentConduct.upsert as Mock).mockResolvedValue(mkConduct());
      await expect(svc.upsertConduct(VD, {
        studentId: 101, classroomId: 1, academicYear: '2026/27',
        semester: Semester.SEMESTER_1, rating: ConductRating.EXCELLENT,
      })).resolves.not.toThrow();
    });
  });

  // updateConduct
  describe('updateConduct', () => {
    it('updates rating and returns updated DTO', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(mkConduct());
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.studentConduct.update as Mock).mockResolvedValue(mkConduct(1, ConductRating.EXCELLENT));
      const r = await svc.updateConduct(DIR, 1, { rating: ConductRating.EXCELLENT });
      expect(r.rating).toBe(ConductRating.EXCELLENT);
    });

    it('throws NotFoundError when conduct record does not exist', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.updateConduct(DIR, 999, { rating: ConductRating.GOOD }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('TEACHER cannot update — ForbiddenError', async () => {
      await expect(svc.updateConduct(TCH, 1, { rating: ConductRating.GOOD }))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // getStudentConduct
  describe('getStudentConduct', () => {
    it('returns conduct for authorized roles', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(mkConduct());
      const r = await svc.getStudentConduct(DIR, 101, 1, Semester.SEMESTER_1, '2026/27');
      expect(r.rating).toBe(ConductRating.GOOD);
    });

    it('throws NotFoundError when no conduct record exists', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.getStudentConduct(DIR, 101, 1, Semester.SEMESTER_1, '2026/27'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('student can view their own conduct', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(mkConduct()); // conduct.student.userId=201
      const r = await svc.getStudentConduct(STU_ACTOR, 101, 1, Semester.SEMESTER_1, '2026/27');
      expect(r).toBeDefined();
    });

    it('student cannot view another student\'s conduct', async () => {
      const otherStu = { ...STU, userId: 999 }; // different userId
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue({ ...mkConduct(), student: otherStu });
      await expect(svc.getStudentConduct(STU_ACTOR, 101, 1, Semester.SEMESTER_1, '2026/27'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('parent can view linked child conduct', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(mkConduct());
      (prisma.studentParentLink.findMany as Mock).mockResolvedValue([{ studentId: 101, parentId: 300 }]);
      await expect(svc.getStudentConduct(PAR_ACTOR, 101, 1, Semester.SEMESTER_1, '2026/27'))
        .resolves.not.toThrow();
    });

    it('parent cannot view unlinked child conduct', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(mkConduct());
      (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]); // no link
      await expect(svc.getStudentConduct(PAR_ACTOR, 101, 1, Semester.SEMESTER_1, '2026/27'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // getClassroomConducts
  describe('getClassroomConducts', () => {
    it('returns list of conduct DTOs for classroom', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.studentConduct.findMany as Mock).mockResolvedValue([mkConduct(), mkConduct(2)]);
      const r = await svc.getClassroomConducts(DIR, 1, Semester.SEMESTER_1, '2026/27');
      expect(r).toHaveLength(2);
    });

    it('returns empty when no conducts recorded', async () => {
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
      const r = await svc.getClassroomConducts(DIR, 1, Semester.SEMESTER_1, '2026/27');
      expect(r).toHaveLength(0);
    });

    it('TEACHER cannot access classroom conducts', async () => {
      await expect(svc.getClassroomConducts(TCH, 1, Semester.SEMESTER_1, '2026/27'))
        .rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // deleteConduct
  describe('deleteConduct', () => {
    it('deletes an existing conduct record', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue({ ...mkConduct(), classroom: CL });
      (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
      (prisma.studentConduct.delete as Mock).mockResolvedValue(undefined);
      await expect(svc.deleteConduct(DIR, 1)).resolves.not.toThrow();
      expect(prisma.studentConduct.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('throws NotFoundError when record does not exist', async () => {
      (prisma.studentConduct.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.deleteConduct(DIR, 999)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('TEACHER cannot delete — ForbiddenError', async () => {
      await expect(svc.deleteConduct(TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('delete NOT called when forbidden', async () => {
      await expect(svc.deleteConduct(TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
      expect(prisma.studentConduct.delete).not.toHaveBeenCalled();
    });
  });
});
