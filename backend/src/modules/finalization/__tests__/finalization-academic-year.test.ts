/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Finalization service — academic year format regression tests.
 *
 * Root cause fixed: finalization.validation.ts rejected "YYYY" academic years.
 * This file tests that the finalization service correctly handles both
 * "2026" and "2026/27" academic year formats for classroom queries.
 *
 * DATABASE SAFETY: all Prisma calls are mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { FinalizationService } from '../finalization.service';
import { FinalizationStatus } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:             { findUnique: vi.fn() },
    teacher:               { findUnique: vi.fn() },
    teacherSubject:        { findUnique: vi.fn(), findMany: vi.fn() },
    gradeSubjectConfig:    { findMany: vi.fn() },
    student:               { findMany: vi.fn() },
    subjectFinalization:   { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    classroomFinalization: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    gradeComponent:        { findMany: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' }, isProduction: false, isDevelopment: false, isTest: true,
}));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));
vi.mock('../../notifications/notification.service', () => ({
  createAutoNotification: vi.fn(), notifyStudentParents: vi.fn(),
}));

import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN    = { userId: 1, role: 'ADMIN'         as const, username: 'adm' };
const DIRECTOR = { userId: 2, role: 'DIRECTOR'      as const, username: 'dir' };
const VD       = { userId: 3, role: 'VICE_DIRECTOR' as const, username: 'vd'  };

// Plain-year classroom (the regression scenario)
const CLASSROOM_2026 = {
  classroomId: 13, className: 'Grade 9', section: 'A',
  academicYear: '2026', homeroomTeacherId: null,
};
// Slash-year classroom (also valid)
const CLASSROOM_SLASH = {
  classroomId: 1, className: 'Grade 9', section: 'A',
  academicYear: '2026/27', homeroomTeacherId: null,
};

const SUBJECT_ENG = { subjectId: 1, subjectCode: 'ENG9', subjectName: 'English' };
const CONFIG_ENG  = { subjectId: 1, sortOrder: 0, subject: SUBJECT_ENG };
const TS_ENG = {
  id: 10, teacherId: 100, subjectId: 1, classroomId: 13,
  subject: SUBJECT_ENG,
  teacher: { teacherId: 100, firstName: 'Ali', lastName: 'Bekele' },
  classroom: CLASSROOM_2026,
};
const TS_ENG_SLASH = { ...TS_ENG, classroomId: 1, classroom: CLASSROOM_SLASH };

function mkSubjectFin(status: FinalizationStatus, tsId = 10, year = '2026') {
  return {
    id: 50, teacherSubjectId: tsId, semester: 'SEMESTER_1' as const, academicYear: year,
    status, reviewedBy: null, reviewedAt: null, finalizedBy: null, finalizedAt: null,
    correctionReason: null, lastCorrectionAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    teacherSubject: TS_ENG,
    reviewedByUser: null, finalizedByUser: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FinalizationService — getClassroomSubjectFinalizations academic year', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it('[REGRESSION] returns subject finalizations for "2026" plain-year classroom', async () => {
    (prisma.classroom.findUnique    as Mock).mockResolvedValue(CLASSROOM_2026);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([TS_ENG]);
    (prisma.student.findMany        as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomSubjectFinalizations(
      ADMIN, 13, 'SEMESTER_1', '2026'
    );
    expect(result).toHaveLength(1);
    expect(result[0].subjectName).toBe('English');
    expect(result[0].academicYear).toBe('2026');
  });

  it('returns DRAFT status for a subject with no finalization record yet', async () => {
    (prisma.classroom.findUnique    as Mock).mockResolvedValue(CLASSROOM_2026);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([TS_ENG]);
    (prisma.student.findMany        as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomSubjectFinalizations(ADMIN, 13, 'SEMESTER_1', '2026');
    expect(result[0].status).toBe('DRAFT');
  });

  it('returns subject with "No teacher assigned" when no TeacherSubject exists', async () => {
    (prisma.classroom.findUnique    as Mock).mockResolvedValue(CLASSROOM_2026);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]); // no assignments
    (prisma.student.findMany        as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomSubjectFinalizations(ADMIN, 13, 'SEMESTER_1', '2026');
    expect(result).toHaveLength(1);
    expect(result[0].teacherSubjectId).toBe(0); // sentinel for "no assignment"
    expect(result[0].teacherName).toMatch(/No teacher assigned/);
  });

  it('404 when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getClassroomSubjectFinalizations(ADMIN, 999, 'SEMESTER_1', '2026')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('still works with "2026/27" slash-year format', async () => {
    (prisma.classroom.findUnique    as Mock).mockResolvedValue(CLASSROOM_SLASH);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CONFIG_ENG]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([TS_ENG_SLASH]);
    (prisma.student.findMany        as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);

    const result = await svc.getClassroomSubjectFinalizations(ADMIN, 1, 'SEMESTER_1', '2026/27');
    expect(result).toHaveLength(1);
    expect(result[0].academicYear).toBe('2026/27');
  });

  it('forbidden for non-oversight roles', async () => {
    const TEACHER = { userId: 10, role: 'TEACHER' as const, username: 'tch' };
    await expect(
      svc.getClassroomSubjectFinalizations(TEACHER, 13, 'SEMESTER_1', '2026')
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getClassroomFinalization with "2026" year ─────────────────────────────────

describe('FinalizationService — getClassroomFinalization academic year', () => {
  let svc: FinalizationService;
  beforeEach(() => { svc = new FinalizationService(); vi.clearAllMocks(); });

  it('[REGRESSION] retrieves classroom finalization record for "2026" year', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_2026);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue({
      id: 1, classroomId: 13, semester: 'SEMESTER_1', academicYear: '2026',
      status: 'FINALIZED' as FinalizationStatus,
      finalizedBy: 1, finalizedAt: new Date('2026-06-01'),
      correctionReason: null, lastCorrectionAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      classroom: CLASSROOM_2026, finalizedByUser: null,
    });

    const dto = await svc.getClassroomFinalization(ADMIN, 13, 'SEMESTER_1', '2026');
    expect(dto.academicYear).toBe('2026');
    expect(dto.status).toBe('FINALIZED');
  });

  it('throws 404 when finalization record does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CLASSROOM_2026);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getClassroomFinalization(ADMIN, 13, 'SEMESTER_1', '2026')
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
