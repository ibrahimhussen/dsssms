/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Academic Register Service — academic year format regression tests.
 *
 * Root cause fixed: validation regex previously rejected "YYYY" format years
 * (e.g. "2026") that exist in the DB, causing "Validation failed" on the
 * Roster page. These tests confirm the service works correctly with both
 * "2026" and "2026/27" academic year formats and that no-section / missing
 * classroom cases produce clear errors.
 *
 * DATABASE SAFETY: all Prisma calls are mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicRegisterService } from '../academic-register.service';
import { AcademicStatus } from '../dto/academic-register.dto';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:             { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    teacher:               { findUnique: vi.fn() },
    teacherSubject:        { findFirst: vi.fn(), findMany: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn() },
    student:               { findMany: vi.fn(), count: vi.fn() },
    attendance:            { groupBy: vi.fn() },
    studentConduct:        { findMany: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), findMany: vi.fn() },
    subjectFinalization:   { findMany: vi.fn() },
    gradeComponent:        { findMany: vi.fn() },
    gradeEntry:            { findMany: vi.fn() },
    systemSetting:         { findUnique: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false, isDevelopment: false, isTest: true,
}));

import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Classroom using the "plain year" format that caused the regression
const CLASSROOM_9A_2026 = {
  classroomId: 13, className: 'Grade 9', section: 'A',
  academicYear: '2026',        // ← plain year format (the real DB format)
  homeroomTeacherId: null,
};

// Classroom using the slash format (also valid)
const CLASSROOM_9A_SLASH = {
  classroomId: 1, className: 'Grade 9', section: 'A',
  academicYear: '2026/27',
  homeroomTeacherId: null,
};

const SUBJECT_ENGLISH = { subjectId: 1, subjectCode: 'ENG9', subjectName: 'English' };
const SUBJECT_MATH    = { subjectId: 2, subjectCode: 'MATH9', subjectName: 'Mathematics' };
const CONFIG_ENG  = { subjectId: 1, sortOrder: 0, subject: SUBJECT_ENGLISH };
const CONFIG_MATH = { subjectId: 2, sortOrder: 1, subject: SUBJECT_MATH };

const STUDENT = {
  studentId: 28, userId: 50, classroomId: 13,
  admissionNumber: 'DSH-2026-00001', firstName: 'Test', lastName: 'Student',
  gender: 'M', dateOfBirth: new Date('2008-03-15'),
};

const DIRECTOR = { userId: 1, role: 'DIRECTOR' as const, username: 'dir' };
const ADMIN    = { userId: 2, role: 'ADMIN'    as const, username: 'adm' };

function setupMocks(
  classroom: typeof CLASSROOM_9A_2026,
  configs: typeof CONFIG_ENG[] = [CONFIG_ENG, CONFIG_MATH],
  students: typeof STUDENT[] = [STUDENT],
) {
  (prisma.classroom.findUnique    as Mock).mockResolvedValue(classroom);
  (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configs);
  (prisma.student.findMany        as Mock).mockResolvedValue(students);
  (prisma.student.count           as Mock).mockResolvedValue(students.length);
  (prisma.attendance.groupBy      as Mock).mockResolvedValue([]);
  (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
  (prisma.classroom.findMany      as Mock).mockResolvedValue([classroom]);
  (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
  (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
  (prisma.gradeEntry.findMany     as Mock).mockResolvedValue([]);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue(
    { promotionPassMark: 50, minimumSubjectPassMark: 40 }
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AcademicRegisterService — academic year format regression', () => {
  let service: AcademicRegisterService;
  beforeEach(() => { service = new AcademicRegisterService(); vi.clearAllMocks(); });

  // ── "2026" plain-year format (the regression case) ───────────────────────

  it('[REGRESSION] accepts "2026" plain-year format and generates register successfully', async () => {
    setupMocks(CLASSROOM_9A_2026);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1',
    });
    expect(register.metadata.academicYear).toBe('2026');
    expect(register.metadata.classroomLabel).toBe('Grade 9 A');
    expect(register.subjects).toHaveLength(2);
    expect(register.students).toHaveLength(1);
  });

  it('[REGRESSION] Grade 9 A with "2026" year returns student rows with PENDING status (no results yet)', async () => {
    setupMocks(CLASSROOM_9A_2026);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1',
    });
    expect(register.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('[REGRESSION] "2026" year: subjects with no teacher assignment render with null finalResult', async () => {
    setupMocks(CLASSROOM_9A_2026);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1',
    });
    for (const sub of register.students[0].subjectResults) {
      expect(sub.finalResult).toBeNull();
      expect(sub.hasAssignment).toBe(false);
    }
  });

  // ── "2026/27" slash format still works ───────────────────────────────────

  it('still accepts "2026/27" slash format correctly', async () => {
    setupMocks(CLASSROOM_9A_SLASH);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_1',
    });
    expect(register.metadata.academicYear).toBe('2026/27');
    expect(register.subjects).toHaveLength(2);
  });

  // ── Missing classroom ─────────────────────────────────────────────────────

  it('throws 404 when classroomId does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(
      service.generateClassroomRegister(DIRECTOR, {
        classroomId: 999, academicYear: '2026', viewMode: 'SEMESTER_1',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── No GradeSubjectConfig for the given year ──────────────────────────────

  it('throws 400 when no GradeSubjectConfig exists for "2026" year', async () => {
    setupMocks(CLASSROOM_9A_2026, []); // empty configs
    await expect(
      service.generateClassroomRegister(DIRECTOR, {
        classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when no GradeSubjectConfig exists for "2026/27" year', async () => {
    setupMocks(CLASSROOM_9A_SLASH, []);
    await expect(
      service.generateClassroomRegister(DIRECTOR, {
        classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_1',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ── Grade-wide register with "2026" year ──────────────────────────────────

  it('[REGRESSION] grade-wide register works with "2026" plain year', async () => {
    // Grade-wide needs: classroom.findMany returns sections, then per-section register
    (prisma.classroom.findMany as Mock).mockResolvedValue([CLASSROOM_9A_2026]);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_9A_2026);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG, CONFIG_MATH]);
    (prisma.student.findMany    as Mock).mockResolvedValue([STUDENT]);
    (prisma.student.count       as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy  as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany     as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(
      { promotionPassMark: 50, minimumSubjectPassMark: 40 }
    );

    const summary = await service.generateGradeRegister(
      ADMIN, 'Grade 9', '2026', 'SEMESTER_1'
    );
    expect(summary.grade).toBe('Grade 9');
    expect(summary.academicYear).toBe('2026');
    expect(summary.totalSections).toBe(1);
    expect(summary.sections[0].section).toBe('A');
  });

  it('grade-wide register throws 404 when no classrooms match grade + year', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([]);
    await expect(
      service.generateGradeRegister(ADMIN, 'Grade 9', '2099', 'SEMESTER_1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ── Classroom ID vs className/year mismatch ───────────────────────────────

  it('register uses the classroom from DB (not the query year) to find GradeSubjectConfig', async () => {
    // classroomId=13 maps to year "2026" in DB even if query sends year "2026"
    // The service must use classroom.className to look up GradeSubjectConfig,
    // not fall back to a hardcoded default
    setupMocks(CLASSROOM_9A_2026, [CONFIG_ENG]);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 13, academicYear: '2026', viewMode: 'SEMESTER_1',
    });
    // GradeSubjectConfig was queried with className="Grade 9", year="2026"
    const gscCall = (prisma.gradeSubjectConfig.findMany as Mock).mock.calls[0][0];
    expect(gscCall.where.className).toBe('Grade 9');
    expect(gscCall.where.academicYear).toBe('2026');
  });

  // ── FULL_YEAR mode with "2026" year ───────────────────────────────────────

  it('[REGRESSION] FULL_YEAR mode works with "2026" plain year', async () => {
    setupMocks(CLASSROOM_9A_2026);
    // FULL_YEAR requires two classroomFinalization lookups
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    const register = await service.generateClassroomRegister(DIRECTOR, {
      classroomId: 13, academicYear: '2026', viewMode: 'FULL_YEAR',
    });
    expect(register.metadata.viewMode).toBe('FULL_YEAR');
    expect(register.metadata.academicYear).toBe('2026');
  });
});
