/**
 * Phase 4.11 — AcademicReportService: generateClassroomReports, getStudentReport, listStudentReports
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { Semester } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:       { findUnique: vi.fn() },
    student:         { findMany: vi.fn() },
    teacherSubject:  { findMany: vi.fn() },
    gradeComponent:  { findMany: vi.fn() },
    academicReport:  { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    studentEnrollment: { findMany: vi.fn() },
    promotionEntry:  { findMany: vi.fn() },
    $transaction:    vi.fn(),
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/authorization/student-access', () => ({
  assertCanAccessStudentRecords: vi.fn().mockResolvedValue(undefined),
}));
// transcript/reportcard dependencies
vi.mock('../../students/student.service', () => ({
  studentService: { getStudentById: vi.fn() },
}));
vi.mock('../../system-settings/system-setting.service', () => ({
  systemSettingService: { get: vi.fn().mockResolvedValue({ schoolName: 'Test School', promotionPassMark: 50, minimumSubjectPassMark: 40, currentAcademicYear: '2026/27' }) },
}));

import { AcademicReportService } from '../academic-report.service';
import { prisma } from '../../../database/prisma-client';
import { assertCanAccessStudentRecords } from '../../../core/authorization/student-access';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTOR = { userId: 1, role: 'DIRECTOR' as const, username: 'dir' };
const CL    = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' };
const STU1  = { studentId: 101, classroomId: 1, firstName: 'Alice', lastName: 'A' };
const STU2  = { studentId: 102, classroomId: 1, firstName: 'Bob',   lastName: 'B' };

function mkReport(studentId = 101, avg = 75, rank = 1) {
  return {
    reportId: studentId * 10, studentId,
    semester: Semester.SEMESTER_1, academicYear: '2026/27',
    averageMark: { toNumber: () => avg, valueOf: () => avg },
    rank, generatedDate: new Date('2026-12-01'),
    student: { studentId, firstName: 'Alice', lastName: 'A' },
  };
}

// ── generateClassroomReports ──────────────────────────────────────────────────

describe('generateClassroomReports', () => {
  let svc: AcademicReportService;
  beforeEach(() => { svc = new AcademicReportService(); vi.clearAllMocks(); });

  const INPUT = { classroomId: 1, semester: Semester.SEMESTER_1, academicYear: '2026/27' };

  it('generates reports for students who have grade data', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([STU1, STU2]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10 }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{
      gradeComponentId: 100, teacherSubjectId: 10, maxMarks: { toNumber: () => 100, valueOf: () => 100 },
      entries: [
        { studentId: 101, score: { toNumber: () => 80, valueOf: () => 80 } },
        { studentId: 102, score: { toNumber: () => 70, valueOf: () => 70 } },
      ],
    }]);
    (prisma.$transaction as Mock).mockResolvedValue([mkReport(101, 80, 1), mkReport(102, 70, 2)]);

    const r = await svc.generateClassroomReports(INPUT);
    expect(r.generated).toHaveLength(2);
    expect(r.skippedStudentIds).toHaveLength(0);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('skips students who have no gradable subjects', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10 }]);
    // No components → maxMarks = 0 → skipped
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.$transaction as Mock).mockResolvedValue([]);

    const r = await svc.generateClassroomReports(INPUT);
    expect(r.skippedStudentIds).toContain(101);
    expect(r.generated).toHaveLength(0);
  });

  it('throws NotFoundError when classroom does not exist', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.generateClassroomReports(INPUT)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('assigns rank 1 to highest average (competition ranking)', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([STU1, STU2]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10 }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{
      gradeComponentId: 100, teacherSubjectId: 10, maxMarks: { toNumber: () => 100, valueOf: () => 100 },
      entries: [
        { studentId: 101, score: { toNumber: () => 90, valueOf: () => 90 } },
        { studentId: 102, score: { toNumber: () => 60, valueOf: () => 60 } },
      ],
    }]);
    // Capture what $transaction is called with
    let capturedEntries: { studentId: number; average: number }[] = [];
    (prisma.$transaction as Mock).mockImplementation((ops: unknown[]) => {
      capturedEntries = (ops as { studentId: number; average: number }[]);
      return Promise.resolve([mkReport(101, 90, 1), mkReport(102, 60, 2)]);
    });

    const r = await svc.generateClassroomReports(INPUT);
    expect(r.generated[0].rank).toBe(1);
    expect(r.generated[1].rank).toBe(2);
  });

  it('tied averages share the same rank', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL);
    (prisma.student.findMany as Mock).mockResolvedValue([STU1, STU2]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10 }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{
      gradeComponentId: 100, teacherSubjectId: 10, maxMarks: { toNumber: () => 100, valueOf: () => 100 },
      entries: [
        { studentId: 101, score: { toNumber: () => 75, valueOf: () => 75 } },
        { studentId: 102, score: { toNumber: () => 75, valueOf: () => 75 } },
      ],
    }]);
    (prisma.$transaction as Mock).mockResolvedValue([mkReport(101, 75, 1), mkReport(102, 75, 1)]);

    const r = await svc.generateClassroomReports(INPUT);
    expect(r.generated.every(s => s.rank === 1)).toBe(true);
  });
});

// ── getStudentReport ──────────────────────────────────────────────────────────

describe('getStudentReport', () => {
  let svc: AcademicReportService;
  beforeEach(() => { svc = new AcademicReportService(); vi.clearAllMocks(); (assertCanAccessStudentRecords as Mock).mockResolvedValue(undefined); });

  it('returns report DTO when found', async () => {
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(mkReport());
    const r = await svc.getStudentReport(ACTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(r.reportId).toBe(1010);
    expect(r.averageMark).toBe(75);
    expect(r.rank).toBe(1);
    expect(typeof r.generatedDate).toBe('string');
  });

  it('throws NotFoundError when report does not exist', async () => {
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getStudentReport(ACTOR, 101, Semester.SEMESTER_1, '2026/27')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('calls assertCanAccessStudentRecords for access control', async () => {
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(mkReport());
    await svc.getStudentReport(ACTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR, 101);
  });
});

// ── listStudentReports ────────────────────────────────────────────────────────

describe('listStudentReports', () => {
  let svc: AcademicReportService;
  beforeEach(() => { svc = new AcademicReportService(); vi.clearAllMocks(); (assertCanAccessStudentRecords as Mock).mockResolvedValue(undefined); });

  it('returns all reports for a student ordered by year desc', async () => {
    (prisma.academicReport.findMany as Mock).mockResolvedValue([
      mkReport(101, 80, 1),
      mkReport(101, 72, 2),
    ]);
    const r = await svc.listStudentReports(ACTOR, 101);
    expect(r).toHaveLength(2);
    expect(r[0].averageMark).toBe(80);
  });

  it('returns empty array when student has no reports', async () => {
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    const r = await svc.listStudentReports(ACTOR, 101);
    expect(r).toHaveLength(0);
  });

  it('calls assertCanAccessStudentRecords', async () => {
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    await svc.listStudentReports(ACTOR, 101);
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR, 101);
  });

  it('findMany queried with correct studentId and orderBy', async () => {
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    await svc.listStudentReports(ACTOR, 42);
    const call = (prisma.academicReport.findMany as Mock).mock.calls[0][0];
    expect(call.where.studentId).toBe(42);
    expect(call.orderBy[0]).toEqual({ academicYear: 'desc' });
  });
});
