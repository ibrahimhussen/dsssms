/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.4 — Grade Service Tests
 *
 * Covers all 8 GradeService methods:
 *  1. createComponent
 *  2. deleteComponent
 *  3. listComponents
 *  4. recordComponentEntries
 *  5. getComponentRoster
 *  6. getClassroomTotals
 *  7. getStudentGrades
 *  8. releaseComponent
 *
 * DATABASE SAFETY: all Prisma calls mocked — no MySQL required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { GradeService } from '../grade.service';
import { GradeCategory, Semester } from '@prisma/client';

// ── Mock Prisma + env ────────────────────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    teacher:         { findUnique: vi.fn() },
    teacherSubject:  { findUnique: vi.fn(), findMany: vi.fn() },
    gradeComponent:  { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn(), count: vi.fn() },
    gradeEntry:      { findMany: vi.fn(), count: vi.fn(), upsert: vi.fn() },
    student:         { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction:    vi.fn(),
    // used by assertCanAccessStudentRecords for TEACHER role
    parentLink:      { findFirst: vi.fn() },
    studentParentLink: { findFirst: vi.fn() },
    userPermission:  { findFirst: vi.fn() },
  },
}));
vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));
// assertCanAccessStudentRecords is used by getStudentGrades
vi.mock('../../../core/authorization/student-access', () => ({
  assertCanAccessStudentRecords: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../database/prisma-client';
import { assertCanAccessStudentRecords } from '../../../core/authorization/student-access';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const YEAR = '2026/27';

const ACTOR_TCH  = { userId: 10, role: 'TEACHER'       as const, username: 'tch' };
const ACTOR_DIR  = { userId: 1,  role: 'DIRECTOR'      as const, username: 'dir' };
const ACTOR_ADMIN = { userId: 2, role: 'ADMIN'         as const, username: 'adm' };
const ACTOR_STU  = { userId: 5,  role: 'STUDENT'       as const, username: 'stu' };

const TEACHER   = { teacherId: 100, userId: 10, firstName: 'Tom', lastName: 'T' };
const TS        = { id: 1, teacherId: 100, subjectId: 1, classroomId: 1,
                    subject: { subjectId: 1, subjectCode: 'ENG', subjectName: 'English' },
                    teacher: TEACHER };

const STU1 = { studentId: 101, userId: 201, classroomId: 1, firstName: 'Alice', lastName: 'A', admissionNumber: 'DSH-001' };
const STU2 = { studentId: 102, userId: 202, classroomId: 1, firstName: 'Bob',   lastName: 'B', admissionNumber: 'DSH-002' };

const COMP_QUIZ: GradeComponentRow = {
  gradeComponentId: 1, teacherSubjectId: 1, semester: Semester.SEMESTER_1,
  academicYear: YEAR, category: GradeCategory.QUIZ, name: 'Quiz 1',
  maxMarks: { toNumber: () => 10 } as unknown as import('@prisma/client').Prisma.Decimal,
  isReleased: false,
  teacherSubject: TS,
};
const COMP_FINAL: GradeComponentRow = {
  gradeComponentId: 2, teacherSubjectId: 1, semester: Semester.SEMESTER_1,
  academicYear: YEAR, category: GradeCategory.FINAL_EXAM, name: 'Final',
  maxMarks: { toNumber: () => 50 } as unknown as import('@prisma/client').Prisma.Decimal,
  isReleased: false,
  teacherSubject: TS,
};

// Prisma returns Decimal objects — helpers to simulate them
type GradeComponentRow = {
  gradeComponentId: number;
  teacherSubjectId: number;
  semester: Semester;
  academicYear: string;
  category: GradeCategory;
  name: string;
  maxMarks: import('@prisma/client').Prisma.Decimal;
  isReleased: boolean;
  teacherSubject?: typeof TS;
  entries?: unknown[];
};

function mkDecimal(n: number): import('@prisma/client').Prisma.Decimal {
  return { toNumber: () => n, toString: () => String(n) } as unknown as import('@prisma/client').Prisma.Decimal;
}

function mkComp(id: number, tsId: number, cat: GradeCategory, maxMarks: number, name = `Comp ${id}`, released = false): GradeComponentRow {
  return {
    gradeComponentId: id, teacherSubjectId: tsId, semester: Semester.SEMESTER_1,
    academicYear: YEAR, category: cat, name, maxMarks: mkDecimal(maxMarks),
    isReleased: released, teacherSubject: TS,
  };
}

// ── 1. createComponent ───────────────────────────────────────────────────────

describe('1. createComponent', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  function setup(existingComponents: GradeComponentRow[] = []) {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(existingComponents);
    (prisma.gradeComponent.create as Mock).mockImplementation(async ({ data }: { data: unknown }) => ({
      ...(data as object), gradeComponentId: 99, isReleased: false,
      maxMarks: mkDecimal((data as Record<string,number>).maxMarks),
    }));
  }

  const BASE_INPUT = {
    teacherSubjectId: 1, semester: Semester.SEMESTER_1, academicYear: YEAR,
    category: GradeCategory.QUIZ, name: 'Quiz 1', maxMarks: 10,
  };

  it('creates a component and returns the DTO', async () => {
    setup();
    const result = await svc.createComponent(ACTOR_TCH, BASE_INPUT);
    expect(result.gradeComponentId).toBe(99);
    expect(result.name).toBe('Quiz 1');
    expect(result.maxMarks).toBe(10);
    expect(result.category).toBe(GradeCategory.QUIZ);
    expect(result.isReleased).toBe(false);
    expect(prisma.gradeComponent.create).toHaveBeenCalledOnce();
  });

  it('throws ConflictError when FINAL_EXAM already exists', async () => {
    setup([mkComp(2, 1, GradeCategory.FINAL_EXAM, 50, 'Final')]);
    await expect(
      svc.createComponent(ACTOR_TCH, { ...BASE_INPUT, category: GradeCategory.FINAL_EXAM, maxMarks: 50, name: 'Final 2' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws ConflictError when adding component would exceed 100 total marks', async () => {
    // existing: quiz=10, test=30, mid=30 → total=70; adding 40 would reach 110
    setup([
      mkComp(1, 1, GradeCategory.QUIZ, 10),
      mkComp(2, 1, GradeCategory.TEST, 30),
      mkComp(3, 1, GradeCategory.MID_EXAM, 30),
    ]);
    await expect(
      svc.createComponent(ACTOR_TCH, { ...BASE_INPUT, maxMarks: 40, name: 'Assignment' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows adding component when total marks stay exactly at 100', async () => {
    // existing: 90 marks; adding 10 → exactly 100
    setup([mkComp(1, 1, GradeCategory.MID_EXAM, 90)]);
    await expect(
      svc.createComponent(ACTOR_TCH, { ...BASE_INPUT, maxMarks: 10, name: 'Quiz' })
    ).resolves.not.toThrow();
  });

  it('throws ForbiddenError when teacher has no teacher profile', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.createComponent(ACTOR_TCH, BASE_INPUT)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws ForbiddenError when teacher does not own the TeacherSubject', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    // TS belongs to teacherId=100, but actor's teacher profile has teacherId=999
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 });
    await expect(svc.createComponent(ACTOR_TCH, BASE_INPUT)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when TeacherSubject does not exist', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.createComponent(ACTOR_TCH, BASE_INPUT)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── 2. deleteComponent ───────────────────────────────────────────────────────

describe('2. deleteComponent', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  it('deletes an owned component without error', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(COMP_QUIZ);
    (prisma.gradeComponent.delete as Mock).mockResolvedValue(undefined);

    await expect(svc.deleteComponent(ACTOR_TCH, 1)).resolves.not.toThrow();
    expect(prisma.gradeComponent.delete).toHaveBeenCalledWith({ where: { gradeComponentId: 1 } });
  });

  it('throws NotFoundError when component does not exist', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.deleteComponent(ACTOR_TCH, 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ForbiddenError when component belongs to a different teacher', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue({
      ...COMP_QUIZ, teacherSubject: { ...TS, teacherId: 999 }, // different owner
    });
    await expect(svc.deleteComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── 3. listComponents ─────────────────────────────────────────────────────────

describe('3. listComponents', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  const QUERY = { teacherSubjectId: 1, semester: Semester.SEMESTER_1, academicYear: YEAR };

  function setupList(components: GradeComponentRow[]) {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(components);
  }

  it('returns all components, totalMaxMarks, remainingMarks, hasFinalExam', async () => {
    setupList([mkComp(1, 1, GradeCategory.QUIZ, 10), mkComp(2, 1, GradeCategory.MID_EXAM, 30)]);
    const r = await svc.listComponents(ACTOR_TCH, QUERY);
    expect(r.components).toHaveLength(2);
    expect(r.totalMaxMarks).toBe(40);
    expect(r.remainingMarks).toBe(60);
    expect(r.hasFinalExam).toBe(false);
  });

  it('hasFinalExam is true when a FINAL_EXAM component exists', async () => {
    setupList([mkComp(1, 1, GradeCategory.FINAL_EXAM, 50, 'Final')]);
    const r = await svc.listComponents(ACTOR_TCH, QUERY);
    expect(r.hasFinalExam).toBe(true);
  });

  it('returns empty components and zero totals when no components defined', async () => {
    setupList([]);
    const r = await svc.listComponents(ACTOR_TCH, QUERY);
    expect(r.components).toHaveLength(0);
    expect(r.totalMaxMarks).toBe(0);
    expect(r.remainingMarks).toBe(100);
  });

  it('DIRECTOR can list components without ownership check', async () => {
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([mkComp(1, 1, GradeCategory.QUIZ, 10)]);
    // Director path does not call teacher.findUnique or teacherSubject.findUnique
    const r = await svc.listComponents(ACTOR_DIR, QUERY);
    expect(r.components).toHaveLength(1);
    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });

  it('ADMIN can list components without ownership check', async () => {
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue([]);
    const r = await svc.listComponents(ACTOR_ADMIN, QUERY);
    expect(r.components).toHaveLength(0);
    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when teacher does not own the TeacherSubject', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 });
    await expect(svc.listComponents(ACTOR_TCH, QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('student role throws ForbiddenError', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.listComponents(ACTOR_STU, QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('component DTO has all expected fields', async () => {
    setupList([mkComp(1, 1, GradeCategory.QUIZ, 15, 'Weekly Quiz')]);
    const r = await svc.listComponents(ACTOR_TCH, QUERY);
    const c = r.components[0];
    expect(c.gradeComponentId).toBe(1);
    expect(c.teacherSubjectId).toBe(1);
    expect(c.semester).toBe(Semester.SEMESTER_1);
    expect(c.academicYear).toBe(YEAR);
    expect(c.category).toBe(GradeCategory.QUIZ);
    expect(c.name).toBe('Weekly Quiz');
    expect(c.maxMarks).toBe(15);
    expect(c.isReleased).toBe(false);
  });
});

// ── 4. recordComponentEntries ─────────────────────────────────────────────────

describe('4. recordComponentEntries', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  function setupRecord(overrides: Partial<typeof COMP_QUIZ> = {}, students = [STU1, STU2]) {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue({ ...COMP_QUIZ, ...overrides });
    (prisma.student.findMany as Mock).mockResolvedValue(students);
    (prisma.$transaction as Mock).mockResolvedValue([]);
  }

  it('saves records and returns gradeComponentId + recordsSaved', async () => {
    setupRecord();
    const input = { records: [{ studentId: 101, score: 8 }, { studentId: 102, score: 7 }] };
    const r = await svc.recordComponentEntries(ACTOR_TCH, 1, input);
    expect(r.gradeComponentId).toBe(1);
    expect(r.recordsSaved).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('throws BadRequestError when a score exceeds maxMarks', async () => {
    setupRecord({ maxMarks: mkDecimal(10) });
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 15 }] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows score equal to maxMarks (boundary)', async () => {
    setupRecord({ maxMarks: mkDecimal(10) }, [STU1]);
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 10 }] })
    ).resolves.not.toThrow();
  });

  it('throws BadRequestError for duplicate studentIds in the batch', async () => {
    setupRecord();
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 8 }, { studentId: 101, score: 7 }] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws BadRequestError when a student is not enrolled in the classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(COMP_QUIZ);
    // Only STU1 found in classroom — studentId 999 is not
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 8 }, { studentId: 999, score: 5 }] })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when grade component does not exist', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 999, { records: [{ studentId: 101, score: 5 }] })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ForbiddenError when teacher does not own the component', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue({
      ...COMP_QUIZ, teacherSubject: { ...TS, teacherId: 999 },
    });
    await expect(
      svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 5 }] })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('calls $transaction for upsert operations', async () => {
    setupRecord({}, [STU1]);
    await svc.recordComponentEntries(ACTOR_TCH, 1, { records: [{ studentId: 101, score: 9 }] });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    // Transaction called with an array (one upsert per record)
    const txArg = (prisma.$transaction as Mock).mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(1);
  });
});

// ── 5. getComponentRoster ─────────────────────────────────────────────────────

describe('5. getComponentRoster', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  function setupRoster(students = [STU1, STU2], entries: { studentId: number; score: number }[] = []) {
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(COMP_QUIZ);
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.student.findMany as Mock).mockResolvedValue(students);
    (prisma.gradeEntry.findMany as Mock).mockResolvedValue(
      entries.map((e) => ({ ...e, score: mkDecimal(e.score) }))
    );
  }

  it('returns component DTO and roster with scores', async () => {
    setupRoster([STU1, STU2], [{ studentId: 101, score: 8 }, { studentId: 102, score: 7 }]);
    const r = await svc.getComponentRoster(ACTOR_TCH, 1);
    expect(r.component.gradeComponentId).toBe(1);
    expect(r.roster).toHaveLength(2);
    const alice = r.roster.find((s) => s.studentId === 101)!;
    expect(alice.score).toBe(8);
    expect(alice.studentName).toBe('Alice A');
  });

  it('score is null for students without a grade entry', async () => {
    setupRoster([STU1, STU2], [{ studentId: 101, score: 8 }]); // STU2 has no entry
    const r = await svc.getComponentRoster(ACTOR_TCH, 1);
    const bob = r.roster.find((s) => s.studentId === 102)!;
    expect(bob.score).toBeNull();
  });

  it('empty classroom returns empty roster', async () => {
    setupRoster([], []);
    const r = await svc.getComponentRoster(ACTOR_TCH, 1);
    expect(r.roster).toHaveLength(0);
  });

  it('DIRECTOR can view roster without ownership check', async () => {
    setupRoster([STU1]);
    const r = await svc.getComponentRoster(ACTOR_DIR, 1);
    expect(r.roster).toHaveLength(1);
    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when teacher does not own the component', async () => {
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue({
      ...COMP_QUIZ, teacherSubject: { ...TS, teacherId: 999 },
    });
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100, not 999
    await expect(svc.getComponentRoster(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when component does not exist', async () => {
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.getComponentRoster(ACTOR_TCH, 999)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── 6. getClassroomTotals ─────────────────────────────────────────────────────

describe('6. getClassroomTotals', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  const QUERY = { teacherSubjectId: 1, semester: Semester.SEMESTER_1, academicYear: YEAR };

  function setupTotals(
    components: { id: number; maxMarks: number; entries: { studentId: number; score: number }[] }[],
    students = [STU1, STU2]
  ) {
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(TS);
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(
      components.map((c) => ({
        gradeComponentId: c.id, teacherSubjectId: 1,
        semester: Semester.SEMESTER_1, academicYear: YEAR,
        category: GradeCategory.QUIZ, name: `Comp ${c.id}`,
        maxMarks: mkDecimal(c.maxMarks), isReleased: false,
        entries: c.entries.map((e) => ({ ...e, score: mkDecimal(e.score) })),
      }))
    );
    (prisma.student.findMany as Mock).mockResolvedValue(students);
  }

  it('returns totalScore and totalMaxMarks per student', async () => {
    setupTotals([
      { id: 1, maxMarks: 10, entries: [{ studentId: 101, score: 8 }, { studentId: 102, score: 6 }] },
      { id: 2, maxMarks: 30, entries: [{ studentId: 101, score: 25 }, { studentId: 102, score: 20 }] },
    ]);
    const r = await svc.getClassroomTotals(ACTOR_TCH, QUERY);
    expect(r).toHaveLength(2);
    const alice = r.find((s) => s.studentId === 101)!;
    expect(alice.totalScore).toBe(33);   // 8+25
    expect(alice.totalMaxMarks).toBe(40); // 10+30
  });

  it('missing entry for a student contributes 0 to totalScore', async () => {
    setupTotals([
      { id: 1, maxMarks: 10, entries: [{ studentId: 101, score: 8 }] }, // STU2 has no entry
    ]);
    const r = await svc.getClassroomTotals(ACTOR_TCH, QUERY);
    const bob = r.find((s) => s.studentId === 102)!;
    expect(bob.totalScore).toBe(0);
    expect(bob.componentScores[0].score).toBeNull();
  });

  it('no components returns all zeros', async () => {
    setupTotals([]);
    const r = await svc.getClassroomTotals(ACTOR_TCH, QUERY);
    for (const row of r) {
      expect(row.totalScore).toBe(0);
      expect(row.totalMaxMarks).toBe(0);
    }
  });

  it('DIRECTOR can view totals without ownership check', async () => {
    setupTotals([{ id: 1, maxMarks: 10, entries: [] }]);
    const r = await svc.getClassroomTotals(ACTOR_DIR, QUERY);
    expect(r).toHaveLength(2);
    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });

  it('throws ForbiddenError when teacher does not own the TeacherSubject', async () => {
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue({ ...TS, teacherId: 999 });
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
    await expect(svc.getClassroomTotals(ACTOR_TCH, QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when TeacherSubject does not exist', async () => {
    (prisma.teacherSubject.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.getClassroomTotals(ACTOR_TCH, QUERY)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('componentScores array contains one entry per component per student', async () => {
    setupTotals([
      { id: 1, maxMarks: 10, entries: [{ studentId: 101, score: 8 }] },
      { id: 2, maxMarks: 20, entries: [{ studentId: 101, score: 15 }] },
    ], [STU1]);
    const r = await svc.getClassroomTotals(ACTOR_TCH, QUERY);
    expect(r[0].componentScores).toHaveLength(2);
  });
});

// ── 7. getStudentGrades ───────────────────────────────────────────────────────

describe('7. getStudentGrades', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  function mkEntry(score: number, released: boolean) {
    return { gradeComponentId: 1, studentId: 101, score: mkDecimal(score) };
  }

  function setupStudentGrades(components: {
    id: number; cat: GradeCategory; maxMarks: number; released: boolean; score?: number;
  }[]) {
    (prisma.student.findUnique as Mock).mockResolvedValue(STU1);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([TS]);
    (prisma.gradeComponent.findMany as Mock).mockResolvedValue(
      components.map((c) => ({
        gradeComponentId: c.id, teacherSubjectId: 1,
        semester: Semester.SEMESTER_1, academicYear: YEAR,
        category: c.cat, name: `Comp ${c.id}`,
        maxMarks: mkDecimal(c.maxMarks), isReleased: c.released,
        entries: c.score !== undefined ? [{ studentId: 101, score: mkDecimal(c.score) }] : [],
      }))
    );
  }

  it('returns subject breakdown for the student', async () => {
    setupStudentGrades([{ id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: true, score: 8 }]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r).toHaveLength(1);
    expect(r[0].subject.subjectName).toBe('English');
    expect(r[0].components).toHaveLength(1);
    expect(r[0].components[0].score).toBe(8);
  });

  it('score is null for unreleased components — student cannot see it', async () => {
    setupStudentGrades([{ id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: false, score: 8 }]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r[0].components[0].score).toBeNull();
    expect(r[0].components[0].isReleased).toBe(false);
  });

  it('score is visible for released components', async () => {
    setupStudentGrades([{ id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: true, score: 9 }]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r[0].components[0].score).toBe(9);
    expect(r[0].components[0].isReleased).toBe(true);
  });

  it('totalScore only sums released components', async () => {
    setupStudentGrades([
      { id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: true,  score: 8 },
      { id: 2, cat: GradeCategory.TEST, maxMarks: 20, released: false, score: 15 }, // not released
    ]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    // Only released component (8) counts
    expect(r[0].totalScore).toBe(8);
  });

  it('totalMaxMarks only counts released components', async () => {
    setupStudentGrades([
      { id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: true,  score: 8 },
      { id: 2, cat: GradeCategory.TEST, maxMarks: 20, released: false, score: 15 },
    ]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r[0].totalMaxMarks).toBe(10); // only the released component's maxMarks
  });

  it('returns empty array when no teacher subjects exist for the classroom', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(STU1);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r).toHaveLength(0);
  });

  it('throws NotFoundError when student does not exist', async () => {
    (prisma.student.findUnique as Mock).mockResolvedValue(null);
    (prisma.teacherSubject.findMany as Mock).mockResolvedValue([]);
    await expect(svc.getStudentGrades(ACTOR_STU, 999, {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('calls assertCanAccessStudentRecords to enforce access control', async () => {
    setupStudentGrades([]);
    await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR_STU, 101);
  });

  it('teacher is included in the breakdown DTO', async () => {
    setupStudentGrades([{ id: 1, cat: GradeCategory.QUIZ, maxMarks: 10, released: true, score: 7 }]);
    const r = await svc.getStudentGrades(ACTOR_STU, 101, {});
    expect(r[0].teacher.teacherId).toBe(TEACHER.teacherId);
    expect(r[0].teacher.firstName).toBe(TEACHER.firstName);
  });
});

// ── 8. releaseComponent ───────────────────────────────────────────────────────

describe('8. releaseComponent', () => {
  let svc: GradeService;
  beforeEach(() => { svc = new GradeService(); vi.clearAllMocks(); });

  function setupRelease(opts: {
    enrolled?: number;
    entered?: number;
    alreadyReleased?: boolean;
    wrongTeacher?: boolean;
  } = {}) {
    const { enrolled = 2, entered = 2, alreadyReleased = false, wrongTeacher = false } = opts;
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue({
      ...COMP_QUIZ,
      isReleased: alreadyReleased,
      teacherSubject: {
        ...TS,
        teacherId: wrongTeacher ? 999 : TEACHER.teacherId,
        classroom: { classroomId: 1 },
      },
    });
    (prisma.student.count as Mock).mockResolvedValue(enrolled);
    (prisma.gradeEntry.count as Mock).mockResolvedValue(entered);
    (prisma.gradeComponent.update as Mock).mockResolvedValue({ ...COMP_QUIZ, isReleased: true, maxMarks: mkDecimal(10) });
  }

  it('releases component when all students have scores', async () => {
    setupRelease({ enrolled: 2, entered: 2 });
    const r = await svc.releaseComponent(ACTOR_TCH, 1);
    expect(r.isReleased).toBe(true);
    expect(prisma.gradeComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isReleased: true } })
    );
  });

  it('throws BadRequestError when some students are missing scores', async () => {
    setupRelease({ enrolled: 2, entered: 1 }); // 1 student without score
    await expect(svc.releaseComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ConflictError when component is already released', async () => {
    setupRelease({ alreadyReleased: true });
    await expect(svc.releaseComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws ForbiddenError when teacher does not own the component', async () => {
    setupRelease({ wrongTeacher: true });
    await expect(svc.releaseComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when component does not exist', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.gradeComponent.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.releaseComponent(ACTOR_TCH, 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ForbiddenError when teacher has no teacher profile', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.releaseComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('component.update is NOT called when release is blocked', async () => {
    setupRelease({ enrolled: 3, entered: 1 }); // 2 missing scores
    await expect(svc.releaseComponent(ACTOR_TCH, 1)).rejects.toMatchObject({ statusCode: 400 });
    expect(prisma.gradeComponent.update).not.toHaveBeenCalled();
  });
});
