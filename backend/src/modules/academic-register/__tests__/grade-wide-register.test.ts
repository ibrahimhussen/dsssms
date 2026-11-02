/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.3 — Grade-Wide Register + Cross-Section Ranking Tests
 *
 * Tests:
 *  A. generateGradeRegister — multi-section aggregation & summary shape
 *  B. gradeRank — cross-section ranking via generateClassroomRegister
 *  C. Authorization
 *  D. GradeSubjectConfig across sections
 *  E. Grade / academic-year isolation
 *  F. Semester & FULL_YEAR mode behaviour
 *
 * DATABASE SAFETY: all Prisma calls mocked — no MySQL required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicRegisterService } from '../academic-register.service';
import { AcademicStatus } from '../dto/academic-register.dto';
import { Semester } from '@prisma/client';

// ── Mock Prisma + env ────────────────────────────────────────────────────────

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
vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

import { prisma } from '../../../database/prisma-client';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const YEAR  = '2026/27';
const YEAR2 = '2027/28';

const ACTOR_DIR  = { userId: 1, role: 'DIRECTOR'      as const, username: 'dir' };
const ACTOR_ADMIN = { userId: 2, role: 'ADMIN'         as const, username: 'adm' };
const ACTOR_VD   = { userId: 3, role: 'VICE_DIRECTOR'  as const, username: 'vd'  };
const ACTOR_TCH  = { userId: 4, role: 'TEACHER'        as const, username: 'tch' };
const ACTOR_STU  = { userId: 5, role: 'STUDENT'        as const, username: 'stu' };
const ACTOR_PAR  = { userId: 6, role: 'PARENT'         as const, username: 'par' };

// Grade 9 classrooms
const CL9A = { classroomId: 1, className: 'Grade 9', section: 'A', academicYear: YEAR, homeroomTeacherId: null };
const CL9B = { classroomId: 2, className: 'Grade 9', section: 'B', academicYear: YEAR, homeroomTeacherId: null };
const CL9C = { classroomId: 3, className: 'Grade 9', section: 'C', academicYear: YEAR, homeroomTeacherId: null };
// Grade 10 classroom (different grade)
const CL10A = { classroomId: 4, className: 'Grade 10', section: 'A', academicYear: YEAR,  homeroomTeacherId: null };
// Grade 9 in a different year
const CL9A_OLD = { classroomId: 5, className: 'Grade 9', section: 'A', academicYear: YEAR2, homeroomTeacherId: null };

// Subjects
const SUB_ENG  = { subjectId: 1, subjectCode: 'ENG',  subjectName: 'English'     };
const SUB_MATH = { subjectId: 2, subjectCode: 'MATH', subjectName: 'Mathematics' };
const SUB_PHY  = { subjectId: 3, subjectCode: 'PHY',  subjectName: 'Physics'     };

const CFG_ENG  = { subjectId: 1, sortOrder: 0, subject: SUB_ENG  };
const CFG_MATH = { subjectId: 2, sortOrder: 1, subject: SUB_MATH };
const CFG_PHY  = { subjectId: 3, sortOrder: 2, subject: SUB_PHY  };

// Students — note classroomId matches their section
const S_A1 = { studentId: 101, userId: 201, classroomId: 1, admissionNumber: 'DSH-A1', firstName: 'Alice',   lastName: 'A', gender: 'F', dateOfBirth: new Date('2010-01-15') };
const S_A2 = { studentId: 102, userId: 202, classroomId: 1, admissionNumber: 'DSH-A2', firstName: 'Amanda',  lastName: 'A', gender: 'F', dateOfBirth: new Date('2010-02-15') };
const S_B1 = { studentId: 103, userId: 203, classroomId: 2, admissionNumber: 'DSH-B1', firstName: 'Bob',     lastName: 'B', gender: 'M', dateOfBirth: new Date('2010-03-15') };
const S_B2 = { studentId: 104, userId: 204, classroomId: 2, admissionNumber: 'DSH-B2', firstName: 'Bernard', lastName: 'B', gender: 'M', dateOfBirth: new Date('2010-04-15') };
const S_C1 = { studentId: 105, userId: 205, classroomId: 3, admissionNumber: 'DSH-C1', firstName: 'Carol',   lastName: 'C', gender: 'F', dateOfBirth: new Date('2010-05-15') };
const S_G10 = { studentId: 201, userId: 301, classroomId: 4, admissionNumber: 'DSH-G10', firstName: 'Dan', lastName: 'D', gender: 'M', dateOfBirth: new Date('2009-01-15') };

const SETTINGS = { promotionPassMark: 50, minimumSubjectPassMark: 40 };
const FINALIZED = { status: 'FINALIZED', finalizedAt: new Date() };

// ── Low-level helpers ────────────────────────────────────────────────────────

/** Resets ALL mock implementations — call in beforeEach. */
function clearAll() {
  vi.clearAllMocks();
}

/**
 * Sets up the minimal single-classroom mock state needed by
 * generateClassroomRegister for ONE classroom+student set.
 * All scores assumed finalized with the given score array.
 */
function setupOneClassroom(
  classroom: typeof CL9A,
  students: typeof S_A1[],
  configs: typeof CFG_ENG[],
  scores: number[],  // one score per configured subject, applied to ALL students
  classFin: unknown = FINALIZED
) {
  const ts   = configs.map((c, i) => ({ id: 10 + i + classroom.classroomId * 100, subjectId: c.subjectId }));
  const fins = ts.map((t) => ({ teacherSubjectId: t.id, status: 'FINALIZED' }));
  const comp = ts.map((t, i) => ({ gradeComponentId: t.id * 10, teacherSubjectId: t.id, maxMarks: 100 }));
  const ent  = students.flatMap((stu) =>
    comp.map((c, i) => ({ gradeComponentId: c.gradeComponentId, studentId: stu.studentId, score: scores[i] }))
  );

  (prisma.teacherSubject.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    if ((where.classroomId as number) === classroom.classroomId) return ts;
    return [];
  });
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
  (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
  (prisma.gradeEntry.findMany as Mock).mockResolvedValue(ent);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);
}

/**
 * Common setup for generateGradeRegister tests over Grade 9 with sections A, B, C.
 * Each section gets its own scores; all subjects finalized.
 *
 * scoreMap: { [classroomId]: score[] } — one score per subject per student
 */
function setupGrade9ThreeSections(
  scoreMap: Record<number, number[]>,
  classFin: unknown = FINALIZED
) {
  const classrooms = [CL9A, CL9B, CL9C];
  const studentMap: Record<number, typeof S_A1[]> = {
    1: [S_A1, S_A2],
    2: [S_B1, S_B2],
    3: [S_C1],
  };
  const configs = [CFG_ENG, CFG_MATH];

  // classroom.findMany — called repeatedly by generateGradeRegister AND buildGradeRankableStudents
  (prisma.classroom.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    if (where.className === 'Grade 9' && where.academicYear === YEAR) return classrooms;
    if (where.className === 'Grade 10') return [CL10A];
    return [];
  });

  // classroom.findUnique — called by generateClassroomRegister
  (prisma.classroom.findUnique as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const id = where.classroomId as number;
    return classrooms.find((c) => c.classroomId === id) ?? null;
  });

  // gradeSubjectConfig.findMany
  (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configs);

  // studentEnrollment.findMany — no historical records, fall back to student.classroomId
  (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
  (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);

  // student.findMany — classroom-scoped
  (prisma.student.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const cid = where.classroomId as number;
    return studentMap[cid] ?? [];
  });

  // student.count — grade-wide (fallback for classrooms without enrollment records)
  (prisma.student.count as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    if (where.classroomId) return studentMap[where.classroomId as number]?.length ?? 0;
    // grade-wide count (used in generateClassroomRegister for totalStudentsInGrade)
    return Object.values(studentMap).reduce((sum, arr) => sum + arr.length, 0);
  });

  // Shared stubs
  (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
  (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);

  // Per-classroom finalization, components, entries
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);

  (prisma.teacherSubject.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const cid = where.classroomId as number;
    return configs.map((c, i) => ({ id: cid * 100 + 10 + i, subjectId: c.subjectId }));
  });

  (prisma.subjectFinalization.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const tsIn = (where.teacherSubjectId as Record<string, number[]>).in;
    return tsIn.map((id: number) => ({ teacherSubjectId: id, status: 'FINALIZED' }));
  });

  (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const tsIn = (where.teacherSubjectId as Record<string, number[]>).in;
    return tsIn.map((id: number) => ({ gradeComponentId: id * 10, teacherSubjectId: id, maxMarks: 100 }));
  });

  (prisma.gradeEntry.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
    const where = args.where as Record<string, unknown>;
    const gcIn = (where.gradeComponentId as Record<string, number[]>).in;
    const stuIn = (where.studentId as Record<string, number[]>).in;

    // Derive classroomId from gradeComponentId: gcId = tsId*10, tsId = cid*100+10+i
    // We need to know which classroom a gradeComponentId belongs to.
    // gcId = tsId * 10, tsId = cid*100+10+i → cid = Math.floor((tsId-10)/100)
    const entries: { gradeComponentId: number; studentId: number; score: number }[] = [];
    for (const gcId of gcIn) {
      const tsId = gcId / 10;
      // tsId = cid*100 + 10 + subjectIndex
      // Find which classroom this tsId belongs to
      let cid = -1;
      for (const cl of classrooms) {
        const offset = cl.classroomId * 100 + 10;
        if (tsId >= offset && tsId < offset + configs.length) {
          cid = cl.classroomId;
          break;
        }
      }
      if (cid === -1) continue;
      const scores = scoreMap[cid];
      if (!scores) continue;
      const subjIdx = (tsId - (cid * 100 + 10));
      const score = scores[subjIdx] ?? 0;
      const stuList = studentMap[cid] ?? [];
      for (const stu of stuList) {
        if (stuIn.includes(stu.studentId)) {
          entries.push({ gradeComponentId: gcId, studentId: stu.studentId, score });
        }
      }
    }
    return entries;
  });
}

// ── A. generateGradeRegister — summary shape ─────────────────────────────────

describe('A. generateGradeRegister — multi-section aggregation', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  it('returns correct grade, academicYear, viewMode in summary', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.grade).toBe('Grade 9');
    expect(r.academicYear).toBe(YEAR);
    expect(r.viewMode).toBe('SEMESTER_1');
  });

  it('totalSections counts all sections returned by classroom.findMany', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.totalSections).toBe(3);
  });

  it('totalStudents is the sum of students across all sections', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    // Section A: 2, Section B: 2, Section C: 1 → total 5
    expect(r.totalStudents).toBe(5);
  });

  it('sections array has one entry per section with correct identifiers', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.sections).toHaveLength(3);
    const sections = r.sections.map((s) => ({ sec: s.section, cid: s.classroomId }));
    expect(sections).toContainEqual({ sec: 'A', cid: 1 });
    expect(sections).toContainEqual({ sec: 'B', cid: 2 });
    expect(sections).toContainEqual({ sec: 'C', cid: 3 });
  });

  it('each section row has correct studentCount', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    const secA = r.sections.find((s) => s.section === 'A')!;
    const secB = r.sections.find((s) => s.section === 'B')!;
    const secC = r.sections.find((s) => s.section === 'C')!;
    expect(secA.studentCount).toBe(2);
    expect(secB.studentCount).toBe(2);
    expect(secC.studentCount).toBe(1);
  });

  it('passCount and failCount per section are correct', async () => {
    // Section A: avg = (70+65)/2 = 67.5 → PASS for both
    // Section B: avg = (80+75)/2 = 77.5 → PASS for both
    // Section C: avg = (60+55)/2 = 57.5 → PASS
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    const secA = r.sections.find((s) => s.section === 'A')!;
    expect(secA.passCount).toBe(2);
    expect(secA.failCount).toBe(0);
  });

  it('sectionAverage is average of student averages (students with results only)', async () => {
    // Section A students both score [70, 70] → avg = 70 each → sectionAverage = 70
    setupGrade9ThreeSections({ 1: [70, 70], 2: [80, 80], 3: [60, 60] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    const secA = r.sections.find((s) => s.section === 'A')!;
    expect(secA.sectionAverage).toBeCloseTo(70, 1);
  });

  it('overallAverage is average of section averages', async () => {
    // Section A avg = 70, Section B avg = 80, Section C avg = 60 → overall = (70+80+60)/3 = 70
    setupGrade9ThreeSections({ 1: [70, 70], 2: [80, 80], 3: [60, 60] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.overallAverage).toBeCloseTo(70, 1);
  });

  it('overallPassRate = totalPass / totalStudents × 100', async () => {
    // All 5 students pass → 100 %
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.overallPassRate).toBeCloseTo(100, 1);
  });

  it('single-section grade returns totalSections = 1', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 110, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 110, status: 'FINALIZED' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1100, teacherSubjectId: 110, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1100, studentId: 101, score: 72 }]);

    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.totalSections).toBe(1);
    expect(r.sections[0].section).toBe('A');
  });

  it('throws NotFoundError when no classrooms exist for the grade', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);

    await expect(
      svc.generateGradeRegister(ACTOR_DIR, 'Grade 99', YEAR, 'SEMESTER_1')
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('grade string normalisation: "9" resolves same as "Grade 9"', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    // "9" is normalised to "Grade 9" by extractClassName
    const r = await svc.generateGradeRegister(ACTOR_DIR, '9', YEAR, 'SEMESTER_1');
    expect(r.grade).toBe('Grade 9');
    expect(r.totalSections).toBe(3);
  });

  it('VICE_DIRECTOR can also call generateGradeRegister', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_VD, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.totalSections).toBe(3);
  });

  it('ADMIN can also call generateGradeRegister', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_ADMIN, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.totalSections).toBe(3);
  });
});

// ── B. Cross-section gradeRank (via generateClassroomRegister) ────────────────

describe('B. Cross-section gradeRank', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  /**
   * Sets up a two-section Grade 9 (A + B) where each section has one student.
   *  - S_A1 scores scoreA in classroomId=1
   *  - S_B1 scores scoreB in classroomId=2
   * classroom.findUnique always returns the requested classroom.
   * classroom.findMany returns both sections (for buildGradeRankableStudents).
   */
  function setupTwoSectionGrade(scoreA: number, scoreB: number, classFin: unknown = FINALIZED) {
    const configs = [CFG_ENG];

    // For classroom.findUnique (called per-request by generateClassroomRegister)
    (prisma.classroom.findUnique as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const id = (args.where as Record<string, unknown>).classroomId as number;
      if (id === 1) return CL9A;
      if (id === 2) return CL9B;
      return null;
    });

    // For classroom.findMany (called by buildGradeRankableStudents)
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A, CL9B]);

    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configs);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);

    // studentEnrollment — no historical records, fall back to student.classroomId
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    (prisma.studentEnrollment.count as Mock).mockResolvedValue(0);

    // student.findMany — classroom-scoped
    (prisma.student.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const cid = where.classroomId as number;
      if (cid === 1) return [S_A1];
      if (cid === 2) return [S_B1];
      return [];
    });

    // student.count — per-classroom (fallback) or grade-wide (used by generateClassroomRegister)
    (prisma.student.count as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      if (where.classroomId) {
        const cid = where.classroomId as number;
        return cid === 1 ? 1 : cid === 2 ? 1 : 0;
      }
      // grade-wide count
      return 2;
    });

    // teacherSubject — classroom-scoped
    (prisma.teacherSubject.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const cid = where.classroomId as number;
      return [{ id: cid * 100, subjectId: 1 }]; // tsId = 100 (cl1) or 200 (cl2)
    });

    // subjectFinalization — always finalized
    (prisma.subjectFinalization.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const tsIn = (where.teacherSubjectId as Record<string, number[]>).in;
      return tsIn.map((id: number) => ({ teacherSubjectId: id, status: 'FINALIZED' }));
    });

    // gradeComponent — tsId → compId = tsId * 10
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const tsIn = (where.teacherSubjectId as Record<string, number[]>).in;
      return tsIn.map((id: number) => ({ gradeComponentId: id * 10, teacherSubjectId: id, maxMarks: 100 }));
    });

    // gradeEntry — compId 1000 → S_A1 scoreA; compId 2000 → S_B1 scoreB
    (prisma.gradeEntry.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const gcIn = (where.gradeComponentId as Record<string, number[]>).in;
      const stuIn = (where.studentId as Record<string, number[]>).in;
      const pool = [
        { gradeComponentId: 1000, studentId: 101, score: scoreA }, // S_A1
        { gradeComponentId: 2000, studentId: 103, score: scoreB }, // S_B1
      ];
      return pool.filter((e) => gcIn.includes(e.gradeComponentId) && stuIn.includes(e.studentId));
    });
  }

  it('student in section A gets gradeRank 1 when their average is highest across grade', async () => {
    setupTwoSectionGrade(90, 80); // A1=90, B1=80 → A1 should be rank 1
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.gradeRank).toBe(1);
  });

  it('student in section B gets gradeRank 1 when their average is highest across grade', async () => {
    setupTwoSectionGrade(80, 90); // A1=80, B1=90 → B1 should be rank 1; A1 rank 2
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.gradeRank).toBe(2);
  });

  it('gradeRank and sectionRank can differ — section rank is within section only', async () => {
    // Section A: A1=80 → sectionRank=1 among A's students
    // Grade-wide: B1=90 is higher → A1 gradeRank=2
    setupTwoSectionGrade(80, 90);
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.sectionRank).toBe(1);  // best in section A
    expect(a1.gradeRank).toBe(2);    // second in grade (B1 beats them)
  });

  it('tied grade-wide averages share the same gradeRank (competition ranking)', async () => {
    setupTwoSectionGrade(75, 75); // A1 and B1 both 75 → gradeRank 1 for both
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.gradeRank).toBe(1);
  });

  it('PENDING student gets gradeRank null', async () => {
    // PENDING requires allFinalized=false — achieved by returning no teacher subjects
    // so every subject has isFinalized=false and no data → PENDING
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A, CL9B]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const cid = ((args.where as Record<string, unknown>).classroomId as number);
      return cid === 1 ? [S_A1] : cid === 2 ? [S_B1] : [];
    });
    (prisma.student.count as Mock).mockResolvedValue(2);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    // No teacher subjects → no components → no results → PENDING
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.academicStatus).toBe(AcademicStatus.PENDING);
    expect(a1.gradeRank).toBeNull();
  });

  it('FAIL student still receives a gradeRank (ranking is not restricted to PASS)', async () => {
    setupTwoSectionGrade(30, 80); // A1 fails (avg=30 < 50 passmark), B1 passes
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    expect(a1.academicStatus).toBe(AcademicStatus.FAIL);
    expect(a1.gradeRank).toBe(2); // ranked 2nd in grade (B1=80 is rank 1)
  });

  it('totalStudentsInGrade reflects the complete grade population, not just the current section', async () => {
    setupTwoSectionGrade(80, 75); // 2 students across 2 sections
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    // totalStudentsInGrade is from student.count (grade-wide), not just this section
    expect(r.students[0].totalStudentsInGrade).toBe(2);
    expect(r.students[0].totalStudentsInSection).toBe(1); // only 1 student in section A
  });
});

// ── C. Authorization ──────────────────────────────────────────────────────────

describe('C. Authorization', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  it('TEACHER cannot call generateGradeRegister — throws ForbiddenError (403)', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);

    await expect(
      svc.generateGradeRegister(ACTOR_TCH, 'Grade 9', YEAR, 'SEMESTER_1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('STUDENT cannot call generateGradeRegister — throws ForbiddenError (403)', async () => {
    await expect(
      svc.generateGradeRegister(ACTOR_STU, 'Grade 9', YEAR, 'SEMESTER_1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('PARENT cannot call generateGradeRegister — throws ForbiddenError (403)', async () => {
    await expect(
      svc.generateGradeRegister(ACTOR_PAR, 'Grade 9', YEAR, 'SEMESTER_1')
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('DIRECTOR can call generateGradeRegister without error', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    await expect(
      svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1')
    ).resolves.not.toThrow();
  });

  it('TEACHER can call generateClassroomRegister when assigned to the classroom', async () => {
    // Teacher (userId=4) must have a TeacherSubject in classroomId=1
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
    // teacher.findUnique must return a valid teacher, and teacherSubject.findFirst must confirm assignment
    (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 10, userId: 4 });
    (prisma.teacherSubject.findFirst as Mock).mockResolvedValue({ id: 10, teacherId: 10, classroomId: 1 });

    await expect(
      svc.generateClassroomRegister(ACTOR_TCH, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' })
    ).resolves.not.toThrow();
  });

  it('TEACHER is rejected when not assigned to the classroom', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    // Teacher has no profile
    (prisma.teacher.findUnique as Mock).mockResolvedValue({ teacherId: 99, userId: 4 });
    (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null); // no assignment
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);

    await expect(
      svc.generateClassroomRegister(ACTOR_TCH, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('STUDENT cannot call generateClassroomRegister', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null);

    await expect(
      svc.generateClassroomRegister(ACTOR_STU, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── D. GradeSubjectConfig across sections ─────────────────────────────────────

describe('D. GradeSubjectConfig — consistent across sections', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  it('[REGRESSION] section without Physics teacher still shows Physics column in its register', async () => {
    // Section A has Physics teacher; Section B does not
    // GradeSubjectConfig has ENG + MATH + PHY for Grade 9

    (prisma.classroom.findUnique as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const id = (args.where as Record<string, unknown>).classroomId as number;
      return id === 1 ? CL9A : id === 2 ? CL9B : null;
    });
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A, CL9B]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG, CFG_MATH, CFG_PHY]);
    (prisma.student.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const cid = ((args.where as Record<string, unknown>).classroomId as number);
      return cid === 2 ? [S_B1] : cid === 1 ? [S_A1] : [];
    });
    (prisma.student.count as Mock).mockResolvedValue(2);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);

    // teacherSubject: Section B has no Physics teacher
    (prisma.teacherSubject.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const cid = ((args.where as Record<string, unknown>).classroomId as number);
      if (cid === 1) return [{ id: 110, subjectId: 1 }, { id: 111, subjectId: 2 }, { id: 112, subjectId: 3 }];
      if (cid === 2) return [{ id: 210, subjectId: 1 }, { id: 211, subjectId: 2 }]; // No Physics
      return [];
    });
    (prisma.subjectFinalization.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const tsIn = ((args.where as Record<string, unknown>).teacherSubjectId as Record<string, number[]>).in;
      return tsIn.map((id: number) => ({ teacherSubjectId: id, status: 'FINALIZED' }));
    });
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const tsIn = ((args.where as Record<string, unknown>).teacherSubjectId as Record<string, number[]>).in;
      return tsIn.map((id: number) => ({ gradeComponentId: id * 10, teacherSubjectId: id, maxMarks: 100 }));
    });
    (prisma.gradeEntry.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const gcIn = ((args.where as Record<string, unknown>).gradeComponentId as Record<string, number[]>).in;
      const stuIn = ((args.where as Record<string, unknown>).studentId as Record<string, number[]>).in;
      const pool = [
        { gradeComponentId: 1100, studentId: 101, score: 70 },
        { gradeComponentId: 1110, studentId: 101, score: 65 },
        { gradeComponentId: 1120, studentId: 101, score: 60 },
        { gradeComponentId: 2100, studentId: 103, score: 80 },
        { gradeComponentId: 2110, studentId: 103, score: 75 },
        // No Physics entry for S_B1 (classroomId 2 has no Physics)
      ];
      return pool.filter((e) => gcIn.includes(e.gradeComponentId) && stuIn.includes(e.studentId));
    });

    // Get register for Section B — Physics must still appear as a column
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 2, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    expect(r.subjects).toHaveLength(3);
    expect(r.subjects.map((s) => s.subjectName)).toContain('Physics');

    // Section B student must have a Physics result entry with null and hasAssignment=false
    const b1 = r.students.find((s) => s.studentId === 103)!;
    const phy = b1.subjectResults.find((sr) => sr.subjectName === 'Physics')!;
    expect(phy).toBeDefined();
    expect(phy.finalResult).toBeNull();
    expect(phy.hasAssignment).toBe(false);
  });

  it('[REGRESSION] unconfigured subject taught in one section cannot appear in grade summary', async () => {
    // Section A has a teacher for subjectId=99 (NOT in GradeSubjectConfig)
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG, CFG_MATH]); // no Physics, no subjectId=99
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);
    // teacherSubject includes subjectId=99 (spurious)
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 110, subjectId: 1 }, { id: 111, subjectId: 2 }, { id: 199, subjectId: 99 },
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([
      { teacherSubjectId: 110, status: 'FINALIZED' },
      { teacherSubjectId: 111, status: 'FINALIZED' },
    ]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1100, teacherSubjectId: 110, maxMarks: 100 },
      { gradeComponentId: 1110, teacherSubjectId: 111, maxMarks: 100 },
    ]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1100, studentId: 101, score: 70 },
      { gradeComponentId: 1110, studentId: 101, score: 65 },
    ]);

    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    expect(r.subjects).toHaveLength(2);
    expect(r.subjects.map((s) => s.subjectId)).not.toContain(99);
  });

  it('GradeSubjectConfig queried with the grade of the requested classroom, not a hardcoded value', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_G10]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL10A]);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 4, academicYear: YEAR, viewMode: 'SEMESTER_1' });

    const calls = (prisma.gradeSubjectConfig.findMany as Mock).mock.calls;
    const where = (calls[0][0] as Record<string, unknown>).where as Record<string, unknown>;
    expect(where.className).toBe('Grade 10');
    expect(where.academicYear).toBe(YEAR);
  });
});

// ── E. Grade / academic-year isolation ────────────────────────────────────────

describe('E. Grade and academic-year isolation', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  it('Grade 9 register does not include Grade 10 students', async () => {
    // classroom.findMany for Grade 9 returns only [CL9A]
    (prisma.classroom.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      if (where.className === 'Grade 9') return [CL9A];
      return [];
    });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    // Only Grade 9 students returned for classroomId=1
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 110, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 110, status: 'FINALIZED' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1100, teacherSubjectId: 110, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1100, studentId: 101, score: 72 }]);

    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    const ids = r.students.map((s) => s.studentId);
    expect(ids).not.toContain(S_G10.studentId);
    expect(r.metadata.grade).toBe('Grade 9');
  });

  it('Grade 9 generateGradeRegister does not include Grade 10 classrooms', async () => {
    // classroom.findMany for Grade 9 must not return CL10A
    (prisma.classroom.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      if (where.className === 'Grade 9' && where.academicYear === YEAR) return [CL9A];
      return [];
    });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    const secCids = r.sections.map((s) => s.classroomId);
    expect(secCids).not.toContain(CL10A.classroomId);
    expect(r.totalSections).toBe(1);
  });

  it('academic year 2026/27 register does not pull 2027/28 classrooms', async () => {
    // Even if both years exist, classroom.findMany must be queried with academicYear=YEAR
    (prisma.classroom.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      if (where.academicYear === YEAR) return [CL9A];
      return [CL9A_OLD];
    });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.academicYear).toBe(YEAR);
    // Must only include classroom from YEAR, not YEAR2
    const cids = r.sections.map((s) => s.classroomId);
    expect(cids).not.toContain(CL9A_OLD.classroomId);
  });

  it('classroom.findMany is called with the correct academicYear', async () => {
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);

    await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');

    const calls = (prisma.classroom.findMany as Mock).mock.calls;
    const firstWhere = (calls[0][0] as Record<string, unknown>).where as Record<string, unknown>;
    expect(firstWhere.academicYear).toBe(YEAR);
    expect(firstWhere.className).toBe('Grade 9');
  });

  it('student section metadata is preserved: each student has correct classroomId', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    // Check Section B register — all students should have classroomId=2 context
    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 2, academicYear: YEAR, viewMode: 'SEMESTER_1' });
    expect(r.metadata.classroomId).toBe(2);
    expect(r.metadata.section).toBe('B');
    expect(r.metadata.grade).toBe('Grade 9');
  });
});

// ── F. Semester / Full-Year modes ─────────────────────────────────────────────

describe('F. Semester and FULL_YEAR modes in grade-wide context', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); clearAll(); });

  it('generateGradeRegister with SEMESTER_1 viewMode sets viewMode in response', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_1');
    expect(r.viewMode).toBe('SEMESTER_1');
  });

  it('generateGradeRegister with SEMESTER_2 viewMode sets viewMode in response', async () => {
    setupGrade9ThreeSections({ 1: [70, 65], 2: [80, 75], 3: [60, 55] });
    const r = await svc.generateGradeRegister(ACTOR_DIR, 'Grade 9', YEAR, 'SEMESTER_2');
    expect(r.viewMode).toBe('SEMESTER_2');
  });

  it('FULL_YEAR viewMode uses 50/50 weighting for gradeRank calculation', async () => {
    // Both S1 and S2 finalized; grade-wide: A1 avg (S1=80, S2=70 → FY=75), B1 avg (S1=70, S2=60 → FY=65)
    // A1 gradeRank should be 1

    (prisma.classroom.findUnique as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const id = (args.where as Record<string, unknown>).classroomId as number;
      return id === 1 ? CL9A : id === 2 ? CL9B : null;
    });
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A, CL9B]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const cid = ((args.where as Record<string, unknown>).classroomId as number);
      return cid === 1 ? [S_A1] : cid === 2 ? [S_B1] : [];
    });
    (prisma.student.count as Mock).mockResolvedValue(2);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);

    // Both classrooms finalized for both semesters
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);

    (prisma.teacherSubject.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const cid = ((args.where as Record<string, unknown>).classroomId as number);
      return [{ id: cid * 100, subjectId: 1 }];
    });
    (prisma.subjectFinalization.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const tsIn = ((args.where as Record<string, unknown>).teacherSubjectId as Record<string, number[]>).in;
      return tsIn.map((id: number) => ({ teacherSubjectId: id, status: 'FINALIZED' }));
    });

    // Semester-aware components: S1 compId = tsId*10, S2 compId = tsId*10 + 1
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const where = args.where as Record<string, unknown>;
      const tsIn = (where.teacherSubjectId as Record<string, number[]>).in;
      const sem = where.semester as string;
      return tsIn.map((id: number) => ({
        gradeComponentId: sem === 'SEMESTER_1' ? id * 10 : id * 10 + 1,
        teacherSubjectId: id,
        maxMarks: 100,
      }));
    });

    // Scores: A1(S1=80, S2=70), B1(S1=70, S2=60)
    (prisma.gradeEntry.findMany as Mock).mockImplementation(async (args: Record<string, unknown>) => {
      const gcIn = ((args.where as Record<string, unknown>).gradeComponentId as Record<string, number[]>).in;
      const stuIn = ((args.where as Record<string, unknown>).studentId as Record<string, number[]>).in;
      // tsId=100 (cl1) → gcS1=1000, gcS2=1001; tsId=200 (cl2) → gcS1=2000, gcS2=2001
      const pool = [
        { gradeComponentId: 1000, studentId: 101, score: 80 }, // A1 S1
        { gradeComponentId: 1001, studentId: 101, score: 70 }, // A1 S2
        { gradeComponentId: 2000, studentId: 103, score: 70 }, // B1 S1
        { gradeComponentId: 2001, studentId: 103, score: 60 }, // B1 S2
      ];
      return pool.filter((e) => gcIn.includes(e.gradeComponentId) && stuIn.includes(e.studentId));
    });

    const r = await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'FULL_YEAR' });
    const a1 = r.students.find((s) => s.studentId === 101)!;
    // FY = (80*0.5 + 70*0.5) = 75 → gradeRank 1
    expect(a1.gradeRank).toBe(1);
    expect(a1.subjectResults[0].finalResult).toBeCloseTo(75, 1);
  });

  it('SEMESTER_1 and SEMESTER_2 produce independent grades — no cross-semester leak', async () => {
    // S1 components use gcId=1000; S2 components use gcId=2000
    // For S1 query, gradeComponent.findMany must only be called with semester=SEMESTER_1

    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.classroom.findMany as Mock).mockResolvedValue([CL9A]);
    (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue([CFG_ENG]);
    (prisma.student.findMany as Mock).mockResolvedValue([S_A1]);
    (prisma.student.count as Mock).mockResolvedValue(1);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
    (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(FINALIZED);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 100, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 100, status: 'FINALIZED' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1000, teacherSubjectId: 100, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1000, studentId: 101, score: 85 }]);

    await svc.generateClassroomRegister(ACTOR_DIR, { classroomId: 1, academicYear: YEAR, viewMode: 'SEMESTER_1' });

    const compCalls = (prisma.gradeComponent.findMany as Mock).mock.calls;
    const semesters = compCalls.map((c: unknown[]) =>
      ((c[0] as Record<string, unknown>).where as Record<string, unknown>).semester
    );
    expect(semesters.every((s) => s === 'SEMESTER_1')).toBe(true);
    expect(semesters.some((s) => s === 'SEMESTER_2')).toBe(false);
  });
});
