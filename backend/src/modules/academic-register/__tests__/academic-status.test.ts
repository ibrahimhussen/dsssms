/**
 * Academic Status Tests � Phase 3.2
 * Tests PENDING / INCOMPLETE / PASS / FAIL and status-separation rules.
 * DATABASE SAFETY: all Prisma calls mocked � no MySQL required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AcademicRegisterService } from '../academic-register.service';
import { AcademicStatus } from '../dto/academic-register.dto';

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
  isProduction: false, isDevelopment: false, isTest: true,
}));

import { prisma } from '../../../database/prisma-client';

const ACTOR  = { userId: 1, role: 'DIRECTOR' as const, username: 'director' };
const CL9A   = { classroomId: 1, className: 'Grade 9',  section: 'A', academicYear: '2026/27', homeroomTeacherId: null };
const CL11A  = { classroomId: 2, className: 'Grade 11', section: 'A', academicYear: '2026/27', homeroomTeacherId: null };

const C1 = { subjectId: 1, sortOrder: 0, subject: { subjectId: 1, subjectCode: 'ENG',  subjectName: 'English'     } };
const C2 = { subjectId: 2, sortOrder: 1, subject: { subjectId: 2, subjectCode: 'MATH', subjectName: 'Mathematics' } };
const C3 = { subjectId: 3, sortOrder: 2, subject: { subjectId: 3, subjectCode: 'PHY',  subjectName: 'Physics'     } };
const C4 = { subjectId: 4, sortOrder: 3, subject: { subjectId: 4, subjectCode: 'BIO',  subjectName: 'Biology'     } };
const C5 = { subjectId: 5, sortOrder: 4, subject: { subjectId: 5, subjectCode: 'CHEM', subjectName: 'Chemistry'   } };

const STU  = { studentId: 101, userId: 201, classroomId: 1, admissionNumber: 'DSH-001',
               firstName: 'Alice', lastName: 'Bekele', gender: 'F', dateOfBirth: new Date('2010-01-15') };
const STU11 = { ...STU, classroomId: 2 };

const Q1  = { classroomId: 1, academicYear: '2026/27', viewMode: 'SEMESTER_1' as const };
const Q11 = { classroomId: 2, academicYear: '2026/27', viewMode: 'SEMESTER_1' as const };
const SETTINGS = { promotionPassMark: 50, minimumSubjectPassMark: 40 };

// -- Helpers -------------------------------------------------------------------

function baseSetup(classroom: typeof CL9A, configs: typeof C1[], students: typeof STU[]) {
  (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]); // no historical records → fall back to student.classroomId
  (prisma.classroom.findUnique as Mock).mockResolvedValue(classroom);
  (prisma.gradeSubjectConfig.findMany as Mock).mockResolvedValue(configs);
  (prisma.student.findMany as Mock).mockResolvedValue(students);
  (prisma.student.count as Mock).mockResolvedValue(students.length);
  (prisma.attendance.groupBy as Mock).mockResolvedValue([]);
  (prisma.studentConduct.findMany as Mock).mockResolvedValue([]);
  (prisma.classroom.findMany as Mock).mockResolvedValue([classroom]);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue(SETTINGS);
}

/** No assignments, no results, optional classroom finalization record. */
function noResults(classroom: typeof CL9A, configs: typeof C1[], students: typeof STU[], classFin: unknown = null) {
  baseSetup(classroom, configs, students);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);
  (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([]);
  (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
  (prisma.gradeEntry.findMany as Mock).mockResolvedValue([]);
}

/** Every subject has an assignment, all FINALIZED, scores provided 1:1 with configs. */
function withScores(
  classroom: typeof CL9A,
  configs:   typeof C1[],
  students:  typeof STU[],
  scores:    number[],
  classFin:  unknown = { status: 'FINALIZED', finalizedAt: new Date() }
) {
  const ts   = configs.map((c, i) => ({ id: 10 + i, subjectId: c.subjectId }));
  const fins = ts.map((t) => ({ teacherSubjectId: t.id, status: 'FINALIZED' }));
  const comp = ts.map((t, i) => ({ gradeComponentId: 100 + i, teacherSubjectId: t.id, maxMarks: 100 }));
  const ent  = comp.map((c, i) => ({ gradeComponentId: c.gradeComponentId, studentId: 101, score: scores[i] }));
  baseSetup(classroom, configs, students);
  (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(classFin);
  (prisma.teacherSubject.findMany as Mock).mockResolvedValue(ts);
  (prisma.subjectFinalization.findMany as Mock).mockResolvedValue(fins);
  (prisma.gradeComponent.findMany as Mock).mockResolvedValue(comp);
  (prisma.gradeEntry.findMany as Mock).mockResolvedValue(ent);
}

// -- PENDING -------------------------------------------------------------------

describe('PENDING status', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('no data, not finalized ? PENDING', async () => {
    noResults(CL9A, [C1], [STU]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('subject has assignment but status is DRAFT ? PENDING', async () => {
    baseSetup(CL9A, [C1], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 10, status: 'DRAFT' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, studentId: 101, score: 80 }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('subject is UNDER_REVIEW (not FINALIZED) ? PENDING', async () => {
    baseSetup(CL9A, [C1], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 10, status: 'UNDER_REVIEW' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, studentId: 101, score: 80 }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('subject is APPROVED (not FINALIZED) ? PENDING', async () => {
    baseSetup(CL9A, [C1], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ id: 10, subjectId: 1 }]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([{ teacherSubjectId: 10, status: 'APPROVED' }]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([{ gradeComponentId: 1, studentId: 101, score: 80 }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('required subject has NO assignment ? isFinalized=false ? PENDING', async () => {
    noResults(CL9A, [C1, C2], [STU]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
  });

  it('PENDING student gets null section rank', async () => {
    noResults(CL9A, [C1], [STU]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].sectionRank).toBeNull();
  });

  it('PENDING is never PASS, FAIL, or INCOMPLETE', async () => {
    noResults(CL9A, [C1], [STU]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    const s = r.students[0].academicStatus;
    expect(s).not.toBe(AcademicStatus.PASS);
    expect(s).not.toBe(AcademicStatus.FAIL);
    expect(s).not.toBe(AcademicStatus.INCOMPLETE);
  });
});

// -- INCOMPLETE ----------------------------------------------------------------

describe('INCOMPLETE status', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('[REGRESSION] all assigned subjects FINALIZED + one has no components ? finalResult null ? INCOMPLETE', async () => {
    // Eng finalized with score. Math finalized with score. Physics finalized but NO components ? null.
    baseSetup(CL9A, [C1, C2, C3], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue({ status: 'FINALIZED', finalizedAt: new Date() });
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 }, { id: 12, subjectId: 3 },
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([
      { teacherSubjectId: 10, status: 'FINALIZED' },
      { teacherSubjectId: 11, status: 'FINALIZED' },
      { teacherSubjectId: 12, status: 'FINALIZED' },
    ]);
    // Physics (ts id=12) has NO components ? service sets finalResult=null
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async ({ where }: { where: { teacherSubjectId: { in: number[] } } }) => {
      const ids = where.teacherSubjectId.in;
      return [
        { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
        { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
        // teacherSubjectId 12 deliberately absent
      ].filter((c) => ids.includes(c.teacherSubjectId));
    });
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1, studentId: 101, score: 72 },
      { gradeComponentId: 2, studentId: 101, score: 65 },
    ]);

    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    const student = r.students[0];
    const phy = student.subjectResults.find((s) => s.subjectName === 'Physics');
    expect(phy).toBeDefined();
    expect(phy!.finalResult).toBeNull();
    expect(phy!.hasAssignment).toBe(true);
    expect(phy!.isFinalized).toBe(true);
    expect(student.academicStatus).toBe(AcademicStatus.INCOMPLETE);
  });

  it('[REGRESSION] no assignment ? PENDING, NOT INCOMPLETE', async () => {
    // Physics has no TeacherSubject ? isFinalized=false ? allFinalized=false ? PENDING
    baseSetup(CL9A, [C1, C2, C3], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue({ status: 'FINALIZED', finalizedAt: new Date() });
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 },
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([
      { teacherSubjectId: 10, status: 'FINALIZED' },
      { teacherSubjectId: 11, status: 'FINALIZED' },
    ]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 },
      { gradeComponentId: 2, teacherSubjectId: 11, maxMarks: 100 },
    ]);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1, studentId: 101, score: 72 },
      { gradeComponentId: 2, studentId: 101, score: 65 },
    ]);

    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PENDING);
    expect(r.students[0].academicStatus).not.toBe(AcademicStatus.INCOMPLETE);
  });

  it('INCOMPLETE student gets null rank', async () => {
    baseSetup(CL9A, [C1, C2], [STU]);
    (prisma.classroomFinalization.findUnique as Mock).mockResolvedValue({ status: 'FINALIZED', finalizedAt: new Date() });
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
      { id: 10, subjectId: 1 }, { id: 11, subjectId: 2 },
    ]);
    (prisma.subjectFinalization.findMany as Mock).mockResolvedValue([
      { teacherSubjectId: 10, status: 'FINALIZED' },
      { teacherSubjectId: 11, status: 'FINALIZED' },
    ]);
    // Only English has components; Math (ts=11) has none ? null
    (prisma.gradeComponent.findMany as Mock).mockImplementation(async ({ where }: { where: { teacherSubjectId: { in: number[] } } }) => {
      const ids = where.teacherSubjectId.in;
      return [{ gradeComponentId: 1, teacherSubjectId: 10, maxMarks: 100 }].filter((c) => ids.includes(c.teacherSubjectId));
    });
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue([
      { gradeComponentId: 1, studentId: 101, score: 90 },
    ]);

    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.INCOMPLETE);
    expect(r.students[0].sectionRank).toBeNull();
  });
});

// -- PASS ----------------------------------------------------------------------

describe('PASS status', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('all finalized, all above minimumSubjectPassMark, avg above promotionPassMark ? PASS', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [72, 65, 58]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });

  it('average exactly equal to promotionPassMark (50) ? PASS', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [50, 50, 50]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });

  it('subject mark exactly at minimumSubjectPassMark (40) ? not in failedSubjects', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [40, 60, 60]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].failedSubjects).not.toContain('English');
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });

  it('PASS student receives a section rank', async () => {
    withScores(CL9A, [C1], [STU], [75]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].sectionRank).toBe(1);
  });

  it('Grade 9: 1 failed subject, avg=52 (exactly the Grade 9 threshold) ? PASS', async () => {
    // avg = (30+62+64)/3 = 52.0, 1 subject below 40. Grade 9 minAvg for 1 failed = 52 ? PASS
    withScores(CL9A, [C1, C2, C3], [STU], [30, 62, 64]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });

  it('Grade 11: 1 failed subject, avg=53 (exactly the Grade 11 threshold) ? PASS', async () => {
    // avg = (30+63+66)/3 = 53. Grade 11 minAvg for 1 failed = 53 ? PASS
    withScores(CL11A, [C1, C2, C3], [STU11], [30, 63, 66]);
    const r = await svc.generateClassroomRegister(ACTOR, Q11);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });
});

// -- FAIL ----------------------------------------------------------------------

describe('FAIL status', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('average one below promotionPassMark (49) ? FAIL', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [49, 49, 49]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('subject one below minimumSubjectPassMark (39) ? in failedSubjects', async () => {
    withScores(CL9A, [C1, C2], [STU], [39, 80]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].failedSubjects).toContain('English');
    expect(r.students[0].failedSubjects).not.toContain('Mathematics');
  });

  it('low average causes FAIL even when no subject individually fails', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [42, 42, 42]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    expect(r.students[0].failedSubjects).toHaveLength(0);
  });

  it('Grade 9: 4 failed subjects ? unconditional FAIL', async () => {
    withScores(CL9A, [C1, C2, C3, C4], [STU], [30, 30, 30, 30]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('Grade 9: 1 failed subject, avg=51 (above 52 threshold) � wait, 51<52 ? FAIL', async () => {
    // avg=(30+60+63)/3=51. Grade 9 minAvg for 1 failed=52. 51<52 ? FAIL
    withScores(CL9A, [C1, C2, C3], [STU], [30, 60, 63]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('Grade 11: 1 failed subject, avg=52 (below Grade 11 threshold of 53) ? FAIL', async () => {
    // avg=(30+62+64)/3=52. Grade 11 minAvg for 1 failed=53. 52<53 ? FAIL
    withScores(CL11A, [C1, C2, C3], [STU11], [30, 62, 64]);
    const r = await svc.generateClassroomRegister(ACTOR, Q11);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('Grade 11: 4+ failed subjects ? unconditional FAIL', async () => {
    withScores(CL11A, [C1, C2, C3, C4, C5], [STU11], [30, 30, 30, 30, 30]);
    const r = await svc.generateClassroomRegister(ACTOR, Q11);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
  });

  it('FAIL student still receives a section rank', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [30, 30, 30]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    expect(r.students[0].sectionRank).toBe(1);
  });

  it('attendance does NOT determine PASS/FAIL � high absences with passing grades ? PASS', async () => {
    withScores(CL9A, [C1], [STU], [80]);
    (prisma.attendance.groupBy as Mock).mockResolvedValue([{ studentId: 101, _count: { _all: 50 } }]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
  });
});

// -- Status separation ---------------------------------------------------------

describe('Status separation: academic vs promotion', () => {
  let svc: AcademicRegisterService;
  beforeEach(() => { svc = new AcademicRegisterService(); vi.clearAllMocks(); });

  it('PASS is never PROMOTED', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [72, 65, 58]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.PASS);
    expect(r.students[0].academicStatus).not.toBe('PROMOTED' as AcademicStatus);
  });

  it('FAIL is never REPEATED', async () => {
    withScores(CL9A, [C1, C2, C3], [STU], [30, 30, 30]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.students[0].academicStatus).toBe(AcademicStatus.FAIL);
    expect(r.students[0].academicStatus).not.toBe('REPEATED' as AcademicStatus);
  });

  it('academicStatus is always one of four defined values � never a promotion string', async () => {
    withScores(CL9A, [C1], [STU], [75]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    const valid = [AcademicStatus.PASS, AcademicStatus.FAIL, AcademicStatus.INCOMPLETE, AcademicStatus.PENDING];
    expect(valid).toContain(r.students[0].academicStatus);
    expect(['PROMOTED', 'REPEATED', 'GRADUATED']).not.toContain(r.students[0].academicStatus);
  });

  it('isOfficialView false when not finalized', async () => {
    noResults(CL9A, [C1], [STU]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.metadata.isOfficialView).toBe(false);
  });

  it('isOfficialView true when classroom is FINALIZED', async () => {
    withScores(CL9A, [C1], [STU], [75]);
    const r = await svc.generateClassroomRegister(ACTOR, Q1);
    expect(r.metadata.isOfficialView).toBe(true);
  });
});
