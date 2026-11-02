/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.2 — Full-Year Register + Grade-Wide Ranking
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicRegisterService } from '../academic-register.service';
import { AcademicStatus } from '../dto/academic-register.dto';
import { Semester } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    studentEnrollment:     { findMany: vi.fn(), count: vi.fn() },
    classroom:             { findUnique: vi.fn(), findMany: vi.fn() },
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
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));

import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ACTOR = { userId: 1, role: 'DIRECTOR' as const, username: 'd1' };
const CL9A  = { classroomId: 1, className: 'Grade 9',  section: 'A', academicYear: '2026/27', homeroomTeacherId: null };
const CL9B  = { classroomId: 2, className: 'Grade 9',  section: 'B', academicYear: '2026/27', homeroomTeacherId: null };
const CL10A = { classroomId: 3, className: 'Grade 10', section: 'A', academicYear: '2026/27', homeroomTeacherId: null };

const C1 = { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: 'ENG',  subjectName: 'English'     } };
const C2 = { subjectId: 2, sortOrder: 1, subject: { subjectId: 2, subjectCode: 'MATH', subjectName: 'Mathematics' } };
const C3 = { subjectId: 3, sortOrder: 2, subject: { subjectId: 3, subjectCode: 'PHY',  subjectName: 'Physics'     } };

const STU1 = { studentId: 101, userId: 201, classroomId: 1, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele',  gender: 'F', dateOfBirth: new Date('2010-01-15') };
const STU2 = { studentId: 102, userId: 202, classroomId: 1, admissionNumber: 'DSH-002', firstName: 'Bob',   lastName: 'Tadesse', gender: 'M', dateOfBirth: new Date('2010-06-20') };

const SETTINGS = { promotionPassMark: 50, minimumSubjectPassMark: 40 };
const Q_FY = { classroomId: 1, academicYear: '2026/27', viewMode: 'FULL_YEAR' as const };
const Q_S1 = { classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_1' as const };
const Q_S2 = { classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_2' as const };
const FINALIZED = { status: 'FINALIZED', finalizedAt: new Date() };

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupBase(cl: typeof CL9A, configs: typeof C1[], students: typeof STU1[], classFin: unknown = null) {
  (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]); // no historical records → fall back to student.classroomId
  (prisma.classroom.findUnique as Mock).mockResolvedValue(cl);
  (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configs);
  (prisma.student.findMany as Mock).mockResolvedValue(students);
  (prisma.student.count as Mock).mockResolvedValue(students.length);
  (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
  (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
  (prisma.classroom.findMany as Mock).mockResolvedValue([cl]);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);
}

/**
 * Sets up semester-aware gradeComponent mock.
 * comps1 used for SEMESTER_1, comps2 for SEMESTER_2.
 */
function setupTwoSemesters(
  configs: typeof C1[],
  students: typeof STU1[],
  s1scores: number[],
  s2scores: number[],
  classFin: unknown = FINALIZED
) {
  const ts    = configs.map((c, i) => ({ id: 10 + i, subjectId: c.subjectId }));
  const fins  = ts.map((t) => ({ teacherSubjectId: t.id, status: 'FINALIZED' }));
  const comp1 = ts.map((t, i) => ({ gradeComponentId: 100 + i, teacherSubjectId: t.id, maxMarks: 100 }));
  const comp2 = ts.map((t, i) => ({ gradeComponentId: 200 + i, teacherSubjectId: t.id, maxMarks: 100 }));
  const ent1  = comp1.map((c, i) => ({ gradeComponentId: c.gradeComponentId, studentId: 101, score: s1scores[i] }));
  const ent2  = comp2.map((c, i) => ({ gradeComponentId: c.gradeComponentId, studentId: 101, score: s2scores[i] }));

  setupBase(CL9A, configs, students, classFin);
  (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);

  // Semester-aware component mock (avoids inline TS generics)
  (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const semVal = where.semester as string;
    const tsIn   = (where.teacherSubjectId as Record<string, number[]>).in;
    const pool   = semVal === 'SEMESTER_1' ? comp1 : comp2;
    return pool.filter((c) => tsIn.includes(c.teacherSubjectId));
  });

  (prisma.gradeEntry.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const gcIn  = (where.gradeComponentId as Record<string, number[]>).in;
    return [...ent1, ...ent2].filter((e) => gcIn.includes(e.gradeComponentId));
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Full-year calculation (50/50 weighting)', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('full-year result = S1*0.5 + S2*0.5', async () => {
    setupTwoSemesters([C1], [STU1], [80], [60]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].subjectResults[0].finalResult).toBeCloseTo(70, 1);
  });

  it('equal S1 and S2 produce same full-year result', async () => {
    setupTwoSemesters([C1], [STU1], [75], [75]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].subjectResults[0].finalResult).toBeCloseTo(75, 1);
  });

  it('full-year result null when S1 has no components', async () => {
    setupBase(CL9A, [C1], [STU1], FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 10, status: 'FINALIZED' }]);
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      if (where.semester === 'SEMESTER_1') return [];
      return [{ gradeComponentId: 201, teacherSubjectId: 10, maxMarks: 100 }];
    });
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 201, studentId: 101, score: 70 }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].subjectResults[0].finalResult).toBeNull();
  });

  it('subject column count matches configured subjects in full-year mode', async () => {
    setupTwoSemesters([C1, C2, C3], [STU1], [80, 70, 60], [75, 65, 55]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.subjects).toHaveLength(3);
    expect(r.subjects.map((s) => s.subjectName)).toEqual(['English', 'Mathematics', 'Physics']);
  });

  it('full-year average is PASS when both semesters finalized and above threshold', async () => {
    setupTwoSemesters([C1], [STU1], [70], [60]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });

  it('full-year FAIL when combined average below pass mark', async () => {
    setupTwoSemesters([C1], [STU1], [35], [35]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('full-year PENDING when no assignments and not finalized', async () => {
    setupBase(CL9A, [C1], [STU1], null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('attendance does not affect PASS/FAIL in full-year mode', async () => {
    setupTwoSemesters([C1], [STU1], [80], [70]);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([{ studentId: 101, _count: { _all: 50 } }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });
});

describe('Semester isolation', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('SEMESTER_1 query fetches only SEMESTER_1 components', async () => {
    const ts   = [{ id: 10, subjectId: 1 }];
    const fins = [{ teacherSubjectId: 10, status: 'FINALIZED' }];
    const comp = [{ gradeComponentId: 100, teacherSubjectId: 10, maxMarks: 100 }];
    setupBase(CL9A, [C1], [STU1], FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 100, studentId: 101, score: 80 }]);
    await svc.generateClassroomRegister(ACTOR, Q_S1);
    const calls = (prisma.gradeComponent.findMany as Mock).mock.calls;
    const semesters = calls.map((c: unknown[]) => (c[0] as Record<string, unknown>).where as Record<string, unknown>).map((w) => w.semester);
    expect(semesters.every((s) => s === 'SEMESTER_1')).toBe(true);
    expect(semesters.some((s) => s === 'SEMESTER_2')).toBe(false);
  });

  it('SEMESTER_2 query fetches only SEMESTER_2 components', async () => {
    const ts   = [{ id: 10, subjectId: 1 }];
    const fins = [{ teacherSubjectId: 10, status: 'FINALIZED' }];
    const comp = [{ gradeComponentId: 200, teacherSubjectId: 10, maxMarks: 100 }];
    setupBase(CL9A, [C1], [STU1], FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 200, studentId: 101, score: 65 }]);
    await svc.generateClassroomRegister(ACTOR, Q_S2);
    const calls = (prisma.gradeComponent.findMany as Mock).mock.calls;
    const semesters = calls.map((c: unknown[]) => (c[0] as Record<string, unknown>).where as Record<string, unknown>).map((w) => w.semester);
    expect(semesters.every((s) => s === 'SEMESTER_2')).toBe(true);
    expect(semesters.some((s) => s === 'SEMESTER_1')).toBe(false);
  });

  it('FULL_YEAR query fetches components for both semesters', async () => {
    setupTwoSemesters([C1], [STU1], [80], [60]);
    await svc.generateClassroomRegister(ACTOR, Q_FY);
    const calls = (prisma.gradeComponent.findMany as Mock).mock.calls;
    const semesters = calls.map((c: unknown[]) => (c[0] as Record<string, unknown>).where as Record<string, unknown>).map((w) => w.semester);
    expect(semesters.some((s) => s === 'SEMESTER_1')).toBe(true);
    expect(semesters.some((s) => s === 'SEMESTER_2')).toBe(true);
  });
});

describe('GradeSubjectConfig regression — full-year', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('[REGRESSION] required subject with no assignment stays in column list in FULL_YEAR', async () => {
    setupBase(CL9A, [C1, C2, C3], [STU1], FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 }, // Physics has no assignment
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([
      { teacherSubjectId: 10, status: 'FINALIZED' },
      { teacherSubjectId: 11, status: 'FINALIZED' },
    ]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.subjects).toHaveLength(3);
    expect(r.subjects.map((s) => s.subjectName)).toContain('Physics');
    const phy = r.students[0].subjectResults.find((s) => s.subjectName === 'Physics');
    expect(phy).toBeDefined();
    expect(phy!.finalResult).toBeNull();
    expect(phy!.hasAssignment).toBe(false);
  });

  it('[REGRESSION] TeacherSubject alone cannot add subject not in GradeSubjectConfig', async () => {
    setupBase(CL9A, [C1, C2], [STU1], null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 }, { id: 12, subjectId: 99 }, // subjectId 99 not configured
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.subjects).toHaveLength(2);
    expect(r.subjects.map((s) => s.subjectId)).not.toContain(99);
  });

  it('every student row has a result entry for every configured subject in full-year mode', async () => {
    setupTwoSemesters([C1, C2, C3], [STU1], [80, 70, 60], [75, 65, 55]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    for (const stu of r.students) {
      expect(stu.subjectResults).toHaveLength(3);
    }
  });
});

describe('Grade/year isolation', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('register metadata shows correct grade and section', async () => {
    setupTwoSemesters([C1], [STU1], [70], [65]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.metadata.grade).toBe('Grade 9');
    expect(r.metadata.section).toBe('A');
    expect(r.metadata.academicYear).toBe('2026/27');
  });

  it('GradeSubjectConfig queried with classroom grade and requested academicYear', async () => {
    setupTwoSemesters([C1, C2], [STU1], [70, 65], [68, 60]);
    await svc.generateClassroomRegister(ACTOR, Q_S1);
    const calls = (prisma.gradeSubjectConfig.findMany as Mock).mock.calls;
    const where = (calls[0][0] as Record<string, unknown>).where as Record<string, unknown>;
    expect(where.className).toBe('Grade 9');
    expect(where.academicYear).toBe('2026/27');
  });

  it('Grade 10 classroom uses its own classroomId and grade', async () => {
    setupBase(CL10A, [C1, C2], [{ ...STU1, classroomId: 3 }], null);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL10A]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    const r = await svc.generateClassroomRegister(ACTOR, { classroomId: 3, academicYear: '2026/27', viewMode: 'SEMESTER_1' });
    expect(r.metadata.grade).toBe('Grade 10');
    expect(r.metadata.classroomId).toBe(3);
  });
});

describe('Section ranking', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  function setupTwoStudents(score1: number, score2: number) {
    const ts   = [{ id: 10, subjectId: 1 }];
    const fins = [{ teacherSubjectId: 10, status: 'FINALIZED' }];
    const comp = [{ gradeComponentId: 100, teacherSubjectId: 10, maxMarks: 100 }];
    setupBase(CL9A, [C1], [STU1, STU2], FINALIZED);
    (prisma.student.count as Mock).mockResolvedValue(2);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 100, studentId: 101, score: score1 },
      { gradeComponentId: 100, studentId: 102, score: score2 },
    ]);
  }

  it('higher average gets rank 1', async () => {
    setupTwoStudents(80, 65);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    const alice = r.students.find((s) => s.studentId === 101)!;
    const bob   = r.students.find((s) => s.studentId === 102)!;
    expect(alice.sectionRank).toBe(1);
    expect(bob.sectionRank).toBe(2);
  });

  it('tied averages share same rank (competition ranking)', async () => {
    setupTwoStudents(75, 75);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    const alice = r.students.find((s) => s.studentId === 101)!;
    const bob   = r.students.find((s) => s.studentId === 102)!;
    expect(alice.sectionRank).toBe(1);
    expect(bob.sectionRank).toBe(1);
  });

  it('PENDING student gets null rank', async () => {
    setupBase(CL9A, [C1], [STU1], null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    expect(r.students[0].sectionRank).toBeNull();
  });

  it('FAIL student still receives a section rank', async () => {
    const ts   = [{ id: 10, subjectId: 1 }];
    const fins = [{ teacherSubjectId: 10, status: 'FINALIZED' }];
    const comp = [{ gradeComponentId: 100, teacherSubjectId: 10, maxMarks: 100 }];
    setupBase(CL9A, [C1], [STU1], FINALIZED);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 100, studentId: 101, score: 30 }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_S1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    expect(r.students[0].sectionRank).toBe(1);
  });

  it('section metadata: classroomId and totalStudents correct', async () => {
    setupTwoSemesters([C1], [STU1], [75], [70]);
    const r = await svc.generateClassroomRegister(ACTOR, Q_FY);
    expect(r.metadata.classroomId).toBe(1);
    expect(r.metadata.totalStudents).toBe(1);
  });
});
