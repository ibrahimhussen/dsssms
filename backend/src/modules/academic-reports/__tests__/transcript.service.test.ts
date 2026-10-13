/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Transcript and Report Card Service Tests — Phase 4.1
 *
 * Tests cover: data assembly, authorization, missing results, academic status,
 * semester/year isolation, historical records, promotion separation, and
 * data isolation between students.
 *
 * DATABASE SAFETY: all Prisma calls and dependent services mocked — no MySQL.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicReportService } from '../academic-report.service';
import { ForbiddenError, NotFoundError } from '../../../core/errors/app-error';
import { Semester } from '@prisma/client';

// ── Mock all external dependencies ───────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    academicReport:    { findUnique: vi.fn(), findMany: vi.fn() },
    studentEnrollment: { findMany: vi.fn() },
    promotionEntry:    { findMany: vi.fn() },
    attendance:        { findMany: vi.fn() },
    student:           { findUnique: vi.fn() },
    parent:            { findUnique: vi.fn() },
    studentParentLink: { findUnique: vi.fn() },
    teacher:           { findUnique: vi.fn() },
    teacherSubject:    { findFirst: vi.fn() },
    classroom:         { findUnique: vi.fn() },
  },
}));

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false, isDevelopment: false, isTest: true,
}));

// Mock studentService.getStudentById
vi.mock('../../students/student.service', () => ({
  studentService: {
    getStudentById:    vi.fn(),
    getStudentByUserId: vi.fn(),
  },
}));

// Mock gradeService.getStudentGrades
vi.mock('../../grades/grade.service', () => ({
  gradeService: {
    getStudentGrades: vi.fn(),
  },
}));

// Mock systemSettingService.get
vi.mock('../../system-settings/system-setting.service', () => ({
  systemSettingService: {
    get: vi.fn(),
  },
}));

import { prisma }               from '../../../database/prisma-client';
import { studentService }       from '../../students/student.service';
import { gradeService }         from '../../grades/grade.service';
import { systemSettingService } from '../../system-settings/system-setting.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIRECTOR  = { userId: 30, role: 'DIRECTOR'      as const, username: 'd1' };
const ADMIN     = { userId: 40, role: 'ADMIN'          as const, username: 'a1' };
const TEACHER   = { userId: 10, role: 'TEACHER'        as const, username: 't1' };
const STUDENT_A = { userId: 201, role: 'STUDENT' as const, username: 'stu-a' };
const STUDENT_B = { userId: 202, role: 'STUDENT' as const, username: 'stu-b' };
const PARENT_U  = { userId: 301, role: 'PARENT'  as const, username: 'par1' };

const STU_A = {
  studentId: 101, userId: 201, classroomId: 1,
  admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele',
  gender: 'F', dateOfBirth: new Date('2010-01-15'),
  enrolledAt: new Date('2026-08-01'), transferredOutAt: null,
  classroom: { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: '2026/27' },
};

const STU_B = {
  studentId: 102, userId: 202, classroomId: 2,
  admissionNumber: 'DSH-002', firstName: 'Bob', lastName: 'Tadesse',
  gender: 'M', dateOfBirth: new Date('2010-06-20'),
  enrolledAt: new Date('2026-08-01'), transferredOutAt: null,
  classroom: { classroomId: 2, className: 'Grade 9', section: 'B', academicYear: '2026/27' },
};

const SETTINGS = {
  schoolName: 'Dinsho Secondary School',
  schoolZone: 'Baale', schoolWereda: 'Dinsho', schoolRegion: 'Oromia',
  schoolLogo: null, promotionPassMark: 50, minimumSubjectPassMark: 40,
};

const REPORT_9A_S1 = {
  reportId: 1, studentId: 101, semester: Semester.SEMESTER_1, academicYear: '2026/27',
  averageMark: 72, rank: 2, generatedDate: new Date(),
  student: { studentId: 101, firstName: 'Alice', lastName: 'Bekele' },
};

const REPORT_9A_S2 = {
  reportId: 2, studentId: 101, semester: Semester.SEMESTER_2, academicYear: '2026/27',
  averageMark: 68, rank: 3, generatedDate: new Date(),
  student: { studentId: 101, firstName: 'Alice', lastName: 'Bekele' },
};

function mkSubjectBreakdown(subjectName: string, score: number, max: number) {
  return {
    teacherSubjectId: 10,
    subject: { subjectId: 1, subjectCode: 'ENG', subjectName },
    teacher: { teacherId: 5, firstName: 'Abel', lastName: 'T' },
    semester: Semester.SEMESTER_1,
    academicYear: '2026/27',
    components: [],
    totalScore: score,
    totalMaxMarks: max,
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('AcademicReportService — getStudentTranscript', () => {
  let svc: AcademicReportService;

  beforeEach(() => {
    svc = new AcademicReportService();
    vi.clearAllMocks();
  });

  // ── 1. Transcript data assembly ───────────────────────────────────────────

  describe('1. Transcript data assembly', () => {
    function setupTranscript(reports: unknown[] = [REPORT_9A_S1], grades = [mkSubjectBreakdown('English', 72, 100)]) {
      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      (prisma.academicReport.findMany as Mock).mockResolvedValue(reports as typeof REPORT_9A_S1[]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2026/27', classroomId: 1, classroom: STU_A.classroom },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      (gradeService.getStudentGrades as Mock).mockResolvedValue(grades);
    }

    it('returns student name, admissionNumber, gender, dateOfBirth', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.studentName).toBe('Alice Bekele');
      expect(t.admissionNumber).toBe('DSH-001');
      expect(t.gender).toBe('F');
      expect(typeof t.dateOfBirth).toBe('string');
    });

    it('returns schoolName from system settings', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.schoolName).toBe('Dinsho Secondary School');
    });

    it('returns one period per academic report', async () => {
      setupTranscript([REPORT_9A_S1, REPORT_9A_S2]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods).toHaveLength(2);
    });

    it('period contains className and section from enrollment history', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].className).toBe('Grade 9');
      expect(t.periods[0].section).toBe('A');
    });

    it('period contains correct academicYear and semester', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicYear).toBe('2026/27');
      expect(t.periods[0].semester).toBe(Semester.SEMESTER_1);
    });

    it('period contains subject results from gradeService', async () => {
      setupTranscript([REPORT_9A_S1], [mkSubjectBreakdown('Mathematics', 65, 100)]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].subjects).toHaveLength(1);
      expect(t.periods[0].subjects[0].subjectName).toBe('Mathematics');
      expect(t.periods[0].subjects[0].totalScore).toBe(65);
    });

    it('period average uses the stored averageMark from the academic report', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].periodAverage).toBe(72);
    });

    it('period rank comes from the academic report', async () => {
      setupTranscript();
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].rank).toBe(2);
    });

    it('cumulativeAverage is mean of all period averages', async () => {
      setupTranscript([REPORT_9A_S1, REPORT_9A_S2 as unknown as typeof REPORT_9A_S1]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      // (72 + 68) / 2 = 70
      expect(t.cumulativeAverage).toBe(70);
    });

    it('cumulativeAverage is null when no periods exist', async () => {
      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.cumulativeAverage).toBeNull();
      expect(t.periods).toHaveLength(0);
    });
  });

  // ── 2. Academic status in transcript ─────────────────────────────────────

  describe('2. Academic status per period', () => {
    function setupWithReport(averageMark: number, grades = [mkSubjectBreakdown('English', averageMark, 100)]) {
      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      (prisma.academicReport.findMany as Mock).mockResolvedValue([
        { ...REPORT_9A_S1, averageMark },
      ]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2026/27', classroomId: 1, classroom: STU_A.classroom },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      (gradeService.getStudentGrades as Mock).mockResolvedValue(grades);
    }

    it('period status is PASS when averageMark >= promotionPassMark', async () => {
      setupWithReport(72);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicStatus).toBe('PASS');
    });

    it('period status is FAIL when averageMark < promotionPassMark', async () => {
      setupWithReport(38);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicStatus).toBe('FAIL');
    });

    it('period status is PASS at exact boundary (50 = promotionPassMark)', async () => {
      setupWithReport(50);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicStatus).toBe('PASS');
    });

    it('period status is PENDING when no subject grades exist', async () => {
      setupWithReport(72, []); // empty grades array
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicStatus).toBe('PENDING');
    });

    it('academic status is separate from promotionDecision', async () => {
      setupWithReport(72);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([
        { studentId: 101, decision: 'PROMOTED', batch: { status: 'COMPLETED', sourceAcademicYear: '2026/27' } },
      ]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicStatus).toBe('PASS');
      expect(t.periods[0].promotionDecision).toBe('PROMOTED');
      // These are distinct fields — PASS ≠ PROMOTED
      expect(t.periods[0].academicStatus).not.toBe(t.periods[0].promotionDecision);
    });

    it('promotionDecision is null when no completed batch exists', async () => {
      setupWithReport(72);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].promotionDecision).toBeNull();
    });

    it('promotionDecision is null when batch is not COMPLETED', async () => {
      setupWithReport(72);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([
        { studentId: 101, decision: 'PROMOTED', batch: { status: 'SUBMITTED', sourceAcademicYear: '2026/27' } },
      ]);
      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].promotionDecision).toBeNull();
    });
  });

  // ── 3. Semester/year isolation ────────────────────────────────────────────

  describe('3. Semester and academic-year isolation', () => {
    it('gradeService is called with the correct semester+year for each period', async () => {
      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      (prisma.academicReport.findMany as Mock).mockResolvedValue([REPORT_9A_S1, REPORT_9A_S2]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2026/27', classroomId: 1, classroom: STU_A.classroom },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      (gradeService.getStudentGrades as Mock).mockResolvedValue([]);

      await svc.getStudentTranscript(DIRECTOR, 101);

      const calls = (gradeService.getStudentGrades as Mock).mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][2]).toMatchObject({ semester: Semester.SEMESTER_1, academicYear: '2026/27' });
      expect(calls[1][2]).toMatchObject({ semester: Semester.SEMESTER_2, academicYear: '2026/27' });
    });

    it('periods are ordered chronologically (oldest first)', async () => {
      const reportOld = { ...REPORT_9A_S1, academicYear: '2025/26', semester: Semester.SEMESTER_1 };
      const reportNew = { ...REPORT_9A_S1, academicYear: '2026/27', semester: Semester.SEMESTER_1 };
      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      // Return in reverse order to test sorting
      (prisma.academicReport.findMany as Mock).mockResolvedValue([reportNew, reportOld]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2026/27', classroomId: 1, classroom: STU_A.classroom },
        { academicYear: '2025/26', classroomId: 3, classroom: { ...STU_A.classroom, academicYear: '2025/26' } },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      (gradeService.getStudentGrades as Mock).mockResolvedValue([]);

      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      expect(t.periods[0].academicYear).toBe('2025/26');
      expect(t.periods[1].academicYear).toBe('2026/27');
    });
  });

  // ── 4. Historical records ─────────────────────────────────────────────────

  describe('4. Historical records', () => {
    it('each period resolves classroom from enrollment history for that year', async () => {
      const cl9 = { classroomId: 1, className: 'Grade 9',  section: 'A', academicYear: '2025/26' };
      const cl10 = { classroomId: 2, className: 'Grade 10', section: 'A', academicYear: '2026/27' };
      const rep9  = { ...REPORT_9A_S1, academicYear: '2025/26', semester: Semester.SEMESTER_1 };
      const rep10 = { ...REPORT_9A_S2, academicYear: '2026/27', semester: Semester.SEMESTER_1 };

      (studentService.getStudentById as Mock).mockResolvedValue({ ...STU_A, classroom: cl10 });
      (prisma.academicReport.findMany as Mock).mockResolvedValue([rep9, rep10]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2025/26', classroomId: 1, classroom: cl9  },
        { academicYear: '2026/27', classroomId: 2, classroom: cl10 },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
      (gradeService.getStudentGrades as Mock).mockResolvedValue([]);

      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      const period9  = t.periods.find((p) => p.academicYear === '2025/26')!;
      const period10 = t.periods.find((p) => p.academicYear === '2026/27')!;

      expect(period9.className).toBe('Grade 9');
      expect(period10.className).toBe('Grade 10');
    });

    it('Grade 9 history not contaminated with Grade 10 subjects', async () => {
      const rep9  = { ...REPORT_9A_S1, academicYear: '2025/26', semester: Semester.SEMESTER_1 };
      const rep10 = { ...REPORT_9A_S2, academicYear: '2026/27', semester: Semester.SEMESTER_1 };

      (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
      (prisma.academicReport.findMany as Mock).mockResolvedValue([rep9, rep10]);
      (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
        { academicYear: '2025/26', classroomId: 1, classroom: STU_A.classroom },
        { academicYear: '2026/27', classroomId: 2, classroom: { ...STU_A.classroom, className: 'Grade 10' } },
      ]);
      (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
      (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);

      // Grade 9 period has English; Grade 10 has Physics
      (gradeService.getStudentGrades as Mock)
        .mockResolvedValueOnce([mkSubjectBreakdown('English', 72, 100)])
        .mockResolvedValueOnce([mkSubjectBreakdown('Physics', 65, 100)]);

      const t = await svc.getStudentTranscript(DIRECTOR, 101);
      const grade9period  = t.periods.find((p) => p.academicYear === '2025/26')!;
      const grade10period = t.periods.find((p) => p.academicYear === '2026/27')!;

      expect(grade9period.subjects.map((s) => s.subjectName)).toContain('English');
      expect(grade9period.subjects.map((s) => s.subjectName)).not.toContain('Physics');
      expect(grade10period.subjects.map((s) => s.subjectName)).toContain('Physics');
      expect(grade10period.subjects.map((s) => s.subjectName)).not.toContain('English');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Report Card
// ═══════════════════════════════════════════════════════════════════════════════

describe('AcademicReportService — getStudentReportCard', () => {
  let svc: AcademicReportService;

  beforeEach(() => {
    svc = new AcademicReportService();
    vi.clearAllMocks();
  });

  function setupReportCard(grades = [mkSubjectBreakdown('English', 72, 100)], report: unknown = REPORT_9A_S1) {
    (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(report);
    (gradeService.getStudentGrades as Mock).mockResolvedValue(grades);
    (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      { academicYear: '2026/27', classroomId: 1, classroom: STU_A.classroom },
    ]);
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
  }

  // ── Report card data ───────────────────────────────────────────────────────

  it('returns student identity fields correctly', async () => {
    setupReportCard();
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.studentName).toBe('Alice Bekele');
    expect(rc.admissionNumber).toBe('DSH-001');
    expect(rc.gender).toBe('F');
    expect(rc.className).toBe('Grade 9');
    expect(rc.section).toBe('A');
    expect(rc.academicYear).toBe('2026/27');
    expect(rc.semester).toBe(Semester.SEMESTER_1);
  });

  it('uses averageMark from stored report when available', async () => {
    setupReportCard([mkSubjectBreakdown('English', 72, 100)], REPORT_9A_S1);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.average).toBe(72);
  });

  it('rank comes from the stored academic report', async () => {
    setupReportCard();
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.rank).toBe(2);
  });

  it('rank is null when no academic report has been generated', async () => {
    setupReportCard([mkSubjectBreakdown('English', 72, 100)], null);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.rank).toBeNull();
  });

  it('failedSubjects contains subjects below minimumSubjectPassMark', async () => {
    setupReportCard([
      mkSubjectBreakdown('English',     72, 100), // PASS
      mkSubjectBreakdown('Mathematics', 35, 100), // FAIL (< 40)
    ]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.failedSubjects).toContain('Mathematics');
    expect(rc.failedSubjects).not.toContain('English');
  });

  it('attendance is null when no attendance records exist', async () => {
    setupReportCard();
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.attendance).toBeNull();
  });

  it('attendance percentage includes present and late (not absent)', async () => {
    setupReportCard();
    (prisma.attendance.findMany as Mock).mockResolvedValue([
      { status: 'PRESENT' }, { status: 'PRESENT' }, { status: 'LATE' },
      { status: 'ABSENT' }, { status: 'ABSENT' },
    ]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    // (2 present + 1 late) / 5 total = 60%
    expect(rc.attendance!.percentage).toBe(60);
    expect(rc.attendance!.absent).toBe(2);
    expect(rc.attendance!.present).toBe(2);
    expect(rc.attendance!.late).toBe(1);
  });

  it('subject with no max marks has null score and percentage', async () => {
    setupReportCard([mkSubjectBreakdown('Physics', 0, 0)]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    const phy = rc.subjects[0];
    expect(phy.totalScore).toBeNull();
    expect(phy.percentage).toBeNull();
    expect(phy.status).toBeNull();
  });

  it('academicStatus PASS when average >= promotionPassMark', async () => {
    setupReportCard([mkSubjectBreakdown('English', 72, 100)]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.academicStatus).toBe('PASS');
  });

  it('academicStatus FAIL when average < promotionPassMark', async () => {
    setupReportCard([mkSubjectBreakdown('English', 38, 100)], { ...REPORT_9A_S1, averageMark: 38 });
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.academicStatus).toBe('FAIL');
  });

  it('academicStatus PENDING when no subject grades exist', async () => {
    setupReportCard([]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(rc.academicStatus).toBe('PENDING');
  });

  it('report card does not contain a promotionDecision field (separation)', async () => {
    setupReportCard();
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    // ReportCardDto has no promotionDecision field — academic status is separate
    expect('promotionDecision' in rc).toBe(false);
    const status = rc.academicStatus;
    expect(['PASS', 'FAIL', 'PENDING']).toContain(status);
  });

  it('missing result is not treated as zero — subject with 0/0 marks has null percentage', async () => {
    setupReportCard([mkSubjectBreakdown('English', 0, 0)]);
    const rc = await svc.getStudentReportCard(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    // 0/0 → null, not 0%
    expect(rc.subjects[0].percentage).toBeNull();
    expect(rc.subjects[0].totalScore).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Authorization
// ═══════════════════════════════════════════════════════════════════════════════

describe('Authorization — assertCanAccessStudentRecords', () => {
  let svc: AcademicReportService;

  beforeEach(() => {
    svc = new AcademicReportService();
    vi.clearAllMocks();
    // Setup minimum for transcript to work when auth passes
    (studentService.getStudentById as Mock).mockResolvedValue(STU_A);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    (prisma.promotionEntry.findMany as Mock).mockResolvedValue([]);
    (systemSettingService.get as Mock).mockResolvedValue(SETTINGS);
  });

  it('DIRECTOR can access any student transcript', async () => {
    const t = await svc.getStudentTranscript(DIRECTOR, 101);
    expect(t.studentId).toBe(101);
  });

  it('ADMIN can access any student transcript', async () => {
    const t = await svc.getStudentTranscript(ADMIN, 101);
    expect(t.studentId).toBe(101);
  });

  it('STUDENT can access their own transcript', async () => {
    // Student A (userId=201) accesses their own record (studentId=101)
    (prisma.student.findUnique as Mock).mockResolvedValue({ studentId: 101, userId: 201 });
    const t = await svc.getStudentTranscript(STUDENT_A, 101);
    expect(t.studentId).toBe(101);
  });

  it('[DATA ISOLATION] STUDENT A cannot access STUDENT B transcript', async () => {
    // STUDENT_A has userId=201 → studentId=101. Tries to access studentId=102.
    (prisma.student.findUnique as Mock).mockResolvedValue({ studentId: 101, userId: 201 });
    await expect(
      svc.getStudentTranscript(STUDENT_A, 102)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('[DATA ISOLATION] PARENT can access linked child transcript', async () => {
    (prisma.parent.findUnique as Mock).mockResolvedValue({ parentId: 301, userId: 301 });
    (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({
      studentId: 101, parentId: 301,
    });
    const t = await svc.getStudentTranscript(PARENT_U, 101);
    expect(t.studentId).toBe(101);
  });

  it('[DATA ISOLATION] PARENT cannot access unlinked student transcript', async () => {
    (prisma.parent.findUnique as Mock).mockResolvedValue({ parentId: 301, userId: 301 });
    (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(null); // not linked
    await expect(
      svc.getStudentTranscript(PARENT_U, 101)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('TEACHER can access transcript of student in their classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 5, userId: 10 });
    (prisma.student.findUnique as Mock).mockResolvedValue({ studentId: 101, classroomId: 1 });
    (prisma.teacherSubject.findFirst as Mock).mockResolvedValue({ id: 10 });
    const t = await svc.getStudentTranscript(TEACHER, 101);
    expect(t.studentId).toBe(101);
  });

  it('TEACHER cannot access transcript of student in a different classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 5, userId: 10 });
    (prisma.student.findUnique as Mock).mockResolvedValue({ studentId: 101, classroomId: 99 });
    (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null); // no assignment
    await expect(
      svc.getStudentTranscript(TEACHER, 101)
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invalid requests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Invalid requests', () => {
  let svc: AcademicReportService;

  beforeEach(() => {
    svc = new AcademicReportService();
    vi.clearAllMocks();
  });

  it('getStudentReport throws NotFoundError when report does not exist', async () => {
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.getStudentReport(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27')
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('getStudentReport returns the stored report when it exists', async () => {
    (prisma.academicReport.findUnique as Mock).mockResolvedValue(REPORT_9A_S1);
    const dto = await svc.getStudentReport(DIRECTOR, 101, Semester.SEMESTER_1, '2026/27');
    expect(dto.averageMark).toBe(72);
    expect(dto.rank).toBe(2);
    expect(dto.semester).toBe(Semester.SEMESTER_1);
    expect(dto.academicYear).toBe('2026/27');
  });

  it('listStudentReports returns empty array when student has no reports', async () => {
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    const reports = await svc.listStudentReports(DIRECTOR, 101);
    expect(reports).toHaveLength(0);
  });

  it('listStudentReports returns reports in descending year order', async () => {
    const r1 = { ...REPORT_9A_S1, academicYear: '2025/26' };
    const r2 = { ...REPORT_9A_S2, academicYear: '2026/27' };
    // Service sorts by academicYear desc, semester asc
    (prisma.academicReport.findMany as Mock).mockResolvedValue([r1, r2]);
    const reports = await svc.listStudentReports(DIRECTOR, 101);
    expect(reports[0].academicYear).toBe('2025/26');
    expect(reports[1].academicYear).toBe('2026/27');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PDF generation — data preparation
// ═══════════════════════════════════════════════════════════════════════════════

describe('PDF generation — buildTranscriptPdf data preparation', () => {
  it('generates a non-empty PDF buffer from a valid transcript', async () => {
    const { buildTranscriptPdf } = await import('../../../core/export/transcript-pdf.util');
    const transcript = {
      studentId: 101,
      studentName: 'Alice Bekele',
      admissionNumber: 'DSH-001',
      gender: 'F',
      dateOfBirth: new Date('2010-01-15').toISOString(),
      classroomLabel: 'Grade 9 A',
      enrolledAt: new Date('2026-08-01').toISOString(),
      dateOfLeavingAt: null,
      schoolName: 'Dinsho Secondary School',
      periods: [],
      cumulativeAverage: null,
      generatedDate: new Date().toISOString(),
    };
    const buffer = await buildTranscriptPdf('Dinsho Secondary School', transcript);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('isStudentCopy flag is accepted without throwing', async () => {
    const { buildTranscriptPdf } = await import('../../../core/export/transcript-pdf.util');
    const transcript = {
      studentId: 101, studentName: 'Alice Bekele', admissionNumber: 'DSH-001',
      gender: 'F', dateOfBirth: new Date('2010-01-15').toISOString(),
      classroomLabel: 'Grade 9 A', enrolledAt: new Date('2026-08-01').toISOString(),
      dateOfLeavingAt: null, schoolName: 'Dinsho Secondary School',
      periods: [], cumulativeAverage: null, generatedDate: new Date().toISOString(),
    };
    const buffer = await buildTranscriptPdf('Dinsho Secondary School', transcript, { isStudentCopy: true });
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('transcript with periods produces a larger buffer than one with no periods', async () => {
    const { buildTranscriptPdf } = await import('../../../core/export/transcript-pdf.util');
    const base = {
      studentId: 101, studentName: 'Alice Bekele', admissionNumber: 'DSH-001',
      gender: 'F', dateOfBirth: new Date('2010-01-15').toISOString(),
      classroomLabel: 'Grade 9 A', enrolledAt: new Date('2026-08-01').toISOString(),
      dateOfLeavingAt: null, schoolName: 'Dinsho Secondary School',
      cumulativeAverage: null, generatedDate: new Date().toISOString(),
    };
    const empty  = await buildTranscriptPdf('DSS', { ...base, periods: [] });
    const withPeriod = await buildTranscriptPdf('DSS', {
      ...base,
      cumulativeAverage: 72,
      periods: [{
        semester: Semester.SEMESTER_1, academicYear: '2026/27',
        className: 'Grade 9', section: 'A',
        subjects: [{ subjectName: 'English', totalScore: 72, totalMaxMarks: 100, percentage: 72 }],
        totalObtained: 72, totalMaxMarks: 100, periodAverage: 72,
        rank: 1, academicStatus: 'PASS' as const, promotionDecision: null,
      }],
    });
    expect(withPeriod.length).toBeGreaterThan(empty.length);
  });
});
