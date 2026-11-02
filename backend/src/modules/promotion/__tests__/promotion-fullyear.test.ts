/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Full-year promotion regression tests.
 *
 * Covers the requirements from the "Implement Full-Year Batch Promotion" spec:
 *  - Full-year average = (S1 × 0.5) + (S2 × 0.5)
 *  - Both semesters required; missing S2 → PENDING_REVIEW
 *  - Student promoted to next grade
 *  - Student repeated in same grade
 *  - Grade 12 graduation
 *  - PROMOTED ↔ REPEATED decision changes (before execution)
 *  - Correction after execution (correctEntry)
 *  - Target-grade activity guard (enrollment conflict)
 *  - Duplicate enrollment prevention (upsert not create for source)
 *  - Transaction rollback on failure
 *  - Audit history preserved
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PromotionService } from '../promotion.service';
import { BadRequestError, NotFoundError } from '../../../core/errors/app-error';
import { BatchStatus, EligibilityStatus, PromotionDecision } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:           { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    promotionBatch:      { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
    promotionEntry:      { update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
    student:             { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    studentEnrollment:   { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    academicReport:      { findMany: vi.fn() },
    attendance:          { count: vi.fn() },
    systemSetting:       { findUnique: vi.fn() },
    gradeComponent:      { count: vi.fn() },
    subjectFinalization: { count: vi.fn() },
    $transaction:        vi.fn(),
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../../core/audit/audit-recorder', () => ({ recordAudit: vi.fn() }));
vi.mock('../../notifications/notification.service', () => ({
  createAutoNotification: vi.fn().mockResolvedValue(undefined),
  notifyStudentParents:   vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../database/prisma-client';
import { recordAudit } from '../../../core/audit/audit-recorder';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DIRECTOR = { userId: 30, role: 'DIRECTOR'      as const, username: 'd1' };
const VICE_DIR = { userId: 20, role: 'VICE_DIRECTOR'  as const, username: 'vd1' };

const CL9A  = { classroomId: 1, className: 'Grade 9',  section: 'A', academicYear: '2026/27' };
const CL10A = { classroomId: 2, className: 'Grade 10', section: 'A', academicYear: '2027/28' };
const CL9B  = { classroomId: 3, className: 'Grade 9',  section: 'B', academicYear: '2027/28' };
const CL12A = { classroomId: 5, className: 'Grade 12', section: 'A', academicYear: '2026/27' };

const STU1 = { studentId: 101, classroomId: 1, userId: 201, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele', studentStatus: 'ACTIVE' };
const STU2 = { studentId: 102, classroomId: 1, userId: 202, admissionNumber: 'DSH-002', firstName: 'Bob',   lastName: 'Tadesse', studentStatus: 'ACTIVE' };

const PREPARED_BY = { userId: 20, username: 'vd1', director: null, viceDirector: { firstName: 'V', lastName: 'D' }, administrator: null };

/** Two full-semester reports — the standard passing case */
function passingReports(studentId: number) {
  return [
    { studentId, semester: 'SEMESTER_1', averageMark: '72.00' },
    { studentId, semester: 'SEMESTER_2', averageMark: '76.00' },
  ];
}
/** Two full-semester reports — failing */
function failingReports(studentId: number) {
  return [
    { studentId, semester: 'SEMESTER_1', averageMark: '38.00' },
    { studentId, semester: 'SEMESTER_2', averageMark: '42.00' },
  ];
}

function mkEntry(sid: number, dec: PromotionDecision, elig: EligibilityStatus = EligibilityStatus.ELIGIBLE, tcId: number | null = 2) {
  return {
    id: sid * 100, batchId: 1, studentId: sid, decision: dec, eligibilityStatus: elig,
    targetClassroomId: tcId, averageMark: '74.00', attendancePercent: null, overrideReason: null,
    createdAt: new Date(), updatedAt: new Date(),
    student: { studentId: sid, userId: 200 + sid, classroomId: 1, admissionNumber: 'DSH-00' + sid, firstName: 'Stu', lastName: String(sid) },
    targetClassroom: tcId ? CL10A : null,
  };
}

function mkBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, sourceClassroomId: 1, sourceAcademicYear: '2026/27', targetAcademicYear: '2027/28',
    status: BatchStatus.DRAFT, preparedById: 20, approvedById: null, rejectedById: null,
    rejectionReason: null, submittedAt: null, approvedAt: null, completedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    sourceClassroom: CL9A, preparedBy: PREPARED_BY, approvedBy: null, entries: [],
    ...overrides,
  };
}

function setupCreate(
  classroom: typeof CL9A,
  students: typeof STU1[],
  reportsFor: (sid: number) => ReturnType<typeof passingReports>
) {
  (prisma.classroom.findUnique as Mock).mockResolvedValue(classroom);
  (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
  (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: '50.00' });
  (prisma.student.findMany as Mock).mockResolvedValue(students);
  (prisma.academicReport.findMany as Mock).mockImplementation(
    async ({ where }: any) => reportsFor(where.studentId)
  );
  (prisma.attendance.count as Mock).mockResolvedValue(0);
  const batch = mkBatch({
    entries: students.map((s) =>
      mkEntry(s.studentId, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE)
    ),
  });
  (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
    fn({
      promotionBatch: { create: vi.fn().mockResolvedValue(batch), findUniqueOrThrow: vi.fn().mockResolvedValue(batch) },
      promotionEntry: { createMany: vi.fn() },
    })
  );
}

// ── Full-year average calculation ─────────────────────────────────────────────

describe('full-year average calculation', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('computes (S1 × 0.5) + (S2 × 0.5) and marks ELIGIBLE when above pass mark', async () => {
    // S1=72, S2=76 → full-year = (72×0.5)+(76×0.5) = 74.00
    setupCreate(CL9A, [STU1], () => passingReports(101));

    let capturedEntries: { eligibilityStatus: string; averageMark: number | null }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });

    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.ELIGIBLE);
    expect(capturedEntries[0].averageMark).toBe(74); // (72+76)/2 = 74
  });

  it('marks NOT_ELIGIBLE when full-year average is below pass mark', async () => {
    // S1=38, S2=42 → full-year = (38×0.5)+(42×0.5) = 40.00 < 50
    setupCreate(CL9A, [STU1], () => failingReports(101));

    let capturedEntries: { eligibilityStatus: string; averageMark: number | null }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });

    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.NOT_ELIGIBLE);
    expect(capturedEntries[0].averageMark).toBe(40); // (38+42)/2 = 40
  });

  it('uses exact 50/50 weighting — asymmetric S1 and S2 results in correct weighted average', async () => {
    // S1=60, S2=80 → full-year = (60×0.5)+(80×0.5) = 70.00
    setupCreate(CL9A, [STU1], () => [
      { studentId: 101, semester: 'SEMESTER_1', averageMark: '60.00' },
      { studentId: 101, semester: 'SEMESTER_2', averageMark: '80.00' },
    ]);

    let capturedEntries: { averageMark: number | null }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });
    expect(capturedEntries[0].averageMark).toBe(70);
  });

  it('pass mark exactly at threshold (50.00) → ELIGIBLE', async () => {
    setupCreate(CL9A, [STU1], () => [
      { studentId: 101, semester: 'SEMESTER_1', averageMark: '50.00' },
      { studentId: 101, semester: 'SEMESTER_2', averageMark: '50.00' },
    ]);

    let capturedEntries: { eligibilityStatus: string }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });
    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.ELIGIBLE);
  });
});

// ── Semester 2 missing → PENDING_REVIEW ──────────────────────────────────────

describe('missing Semester 2 → PENDING_REVIEW', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('PENDING_REVIEW when only Semester 1 report exists', async () => {
    setupCreate(CL9A, [STU1], () => [
      { studentId: 101, semester: 'SEMESTER_1', averageMark: '80.00' },
    ]);

    let capturedEntries: { eligibilityStatus: string; averageMark: number | null }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });

    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.PENDING_REVIEW);
    // No average — both semesters required
    expect(capturedEntries[0].averageMark).toBeNull();
  });

  it('PENDING_REVIEW when only Semester 2 report exists', async () => {
    setupCreate(CL9A, [STU1], () => [
      { studentId: 101, semester: 'SEMESTER_2', averageMark: '80.00' },
    ]);

    let capturedEntries: { eligibilityStatus: string }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });
    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.PENDING_REVIEW);
  });

  it('PENDING_REVIEW even when single-semester average is very high (90%)', async () => {
    setupCreate(CL9A, [STU1], () => [
      { studentId: 101, semester: 'SEMESTER_1', averageMark: '90.00' },
    ]);

    let capturedEntries: { eligibilityStatus: string }[] = [];
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        promotionBatch: { create: vi.fn().mockResolvedValue(mkBatch()), findUniqueOrThrow: vi.fn().mockResolvedValue(mkBatch()) },
        promotionEntry: {
          createMany: vi.fn().mockImplementation((args: any) => { capturedEntries = args.data; }),
        },
      })
    );

    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });
    expect(capturedEntries[0].eligibilityStatus).toBe(EligibilityStatus.PENDING_REVIEW);
  });
});

// ── Promoted to next grade ────────────────────────────────────────────────────

describe('student promoted to next grade', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('PROMOTED entry creates source-year (PROMOTED) and target-year (ACTIVE) enrollments', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [entry] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'Alice', lastName: 'A' });

    const mockUpsert = vi.fn().mockResolvedValue({ id: 10 });
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStudentUpdate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: mockStudentUpdate },
        studentEnrollment: { upsert: mockUpsert, create: mockCreate },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
        promotionBatch: { update: vi.fn().mockResolvedValue({}) },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);

    // Source-year enrollment stamped PROMOTED
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          academicYear: '2026/27',
          decision: 'PROMOTED',
        }),
      })
    );
    // New target-year enrollment ACTIVE
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classroomId: 2,
          academicYear: '2027/28',
          decision: 'ACTIVE',
        }),
      })
    );
    // Student pointer updated to target classroom
    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classroomId: 2 } })
    );
  });
});

// ── Repeated in same grade ────────────────────────────────────────────────────

describe('student repeated in same grade', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('REPEATED entry creates source-year (REPEATED) and new active enrollment in same grade', async () => {
    // Target classroom is Grade 9 B (same grade, new year) = CL9B
    const entry = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.NOT_ELIGIBLE, 3);
    (entry as any).targetClassroom = CL9B;
    const submitted = mkBatch({
      status: BatchStatus.SUBMITTED,
      targetAcademicYear: '2027/28',
      entries: [entry],
    });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, targetAcademicYear: '2027/28', entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'Alice', lastName: 'A' });

    const mockUpsert = vi.fn().mockResolvedValue({ id: 10 });
    const mockCreate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: vi.fn() },
        studentEnrollment: { upsert: mockUpsert, create: mockCreate },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL9B) },
        promotionBatch: { update: vi.fn() },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);

    // Source-year enrollment stamped REPEATED
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ decision: 'REPEATED' }),
      })
    );
    // New enrollment in the same-grade classroom
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classroomId: 3, // CL9B
          decision: 'ACTIVE',
        }),
      })
    );
  });

  it('repeated student requires a target classroom — submitBatch blocks without one', async () => {
    const entry = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.NOT_ELIGIBLE, null);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.DRAFT, entries: [entry] })
    );
    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ── Grade 12 graduation ───────────────────────────────────────────────────────

describe('Grade 12 graduation', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('GRADUATED entry marks student GRADUATED and creates source-year enrollment only', async () => {
    const entry = mkEntry(101, PromotionDecision.GRADUATED, EligibilityStatus.ELIGIBLE, null);
    (entry as any).targetClassroom = null;
    const submitted = mkBatch({
      status: BatchStatus.SUBMITTED,
      sourceClassroom: CL12A,
      sourceClassroomId: 5,
      entries: [entry],
    });
    const completed = { ...submitted, status: BatchStatus.COMPLETED };
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'Alice', lastName: 'A' });

    const mockStudentUpdate = vi.fn().mockResolvedValue({});
    const mockUpsert = vi.fn().mockResolvedValue({ id: 10 });
    const mockCreate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: mockStudentUpdate },
        studentEnrollment: { upsert: mockUpsert, create: mockCreate },
        promotionBatch: { update: vi.fn() },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);

    expect(mockStudentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { studentStatus: 'GRADUATED' } })
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ decision: 'GRADUATED' }),
      })
    );
    // No new enrollment created — graduate leaves the system
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('GRADUATED decision rejected for non-Grade-12 classroom', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ entries: [entry] })  // Grade 9 source
    );
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    await expect(
      svc.updateEntry(VICE_DIR, 1, 10100, { decision: PromotionDecision.GRADUATED })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ── Decision changes before execution (PROMOTED ↔ REPEATED) ──────────────────

describe('decision changes before execution', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('changes PROMOTED to REPEATED when Vice Director overrides', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const after  = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.ELIGIBLE, 3);
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(mkBatch({ entries: [entry] }))
      .mockResolvedValueOnce(mkBatch({ entries: [after] }));
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9B); // same-grade repeat classroom
    (prisma.promotionEntry.update as Mock).mockResolvedValue({});

    const result = await svc.updateEntry(VICE_DIR, 1, 10100, {
      decision: PromotionDecision.REPEATED,
      targetClassroomId: 3,
      overrideReason: 'Academic support needed',
    });
    expect(result.entries[0].decision).toBe(PromotionDecision.REPEATED);
  });

  it('changes REPEATED to PROMOTED when Vice Director overrides', async () => {
    const entry = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.NOT_ELIGIBLE, 3);
    const after  = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(mkBatch({ entries: [entry] }))
      .mockResolvedValueOnce(mkBatch({ entries: [after] }));
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.promotionEntry.update as Mock).mockResolvedValue({});

    const result = await svc.updateEntry(VICE_DIR, 1, 10100, {
      decision: PromotionDecision.PROMOTED,
      targetClassroomId: 2,
      overrideReason: 'Additional assessment passed',
    });
    expect(result.entries[0].decision).toBe(PromotionDecision.PROMOTED);
  });

  it('setting overrideReason on PENDING_REVIEW entry bumps eligibility to ELIGIBLE', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.PENDING_REVIEW, null);
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(mkBatch({ entries: [entry] }))
      .mockResolvedValueOnce(mkBatch({ entries: [entry] }));
    (prisma.promotionEntry.update as Mock).mockResolvedValue({});

    await svc.updateEntry(VICE_DIR, 1, 10100, {
      overrideReason: 'Director reviewed manually',
    });

    const updateCall = (prisma.promotionEntry.update as Mock).mock.calls[0][0];
    expect(updateCall.data.eligibilityStatus).toBe(EligibilityStatus.ELIGIBLE);
  });

  it('target classroom must belong to the batch targetAcademicYear', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ entries: [entry], targetAcademicYear: '2027/28' })
    );
    // Classroom in a different year
    (prisma.classroom.findUnique as Mock).mockResolvedValue({ ...CL10A, academicYear: '2025/26' });
    await expect(
      svc.updateEntry(VICE_DIR, 1, 10100, { targetClassroomId: 2 })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ── Correction after execution ────────────────────────────────────────────────

describe('correction after promotion execution', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('correctEntry marks existing ACTIVE enrollment CORRECTED and creates new one', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    // No academic activity in target classroom → allow correction
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);

    const mockUpdateMany = vi.fn().mockResolvedValue({});
    const mockCreate     = vi.fn().mockResolvedValue({});
    const mockFindFirst  = vi.fn().mockResolvedValue({ id: 10 });
    const mockEntryUpdate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: mockUpdateMany, findFirst: mockFindFirst, create: mockCreate },
        student: { update: vi.fn() },
        promotionEntry: { update: mockEntryUpdate },
      })
    );

    await svc.correctEntry(DIRECTOR, 1, 10100, {
      targetClassroomId: 2,
      notes: 'Assigned to wrong section — corrected',
    });

    // Old ACTIVE enrollment marked CORRECTED
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ decision: 'ACTIVE' }),
        data: { decision: 'CORRECTED' },
      })
    );
    // New ACTIVE enrollment created
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          classroomId: 2,
          decision: 'ACTIVE',
          notes: 'Assigned to wrong section — corrected',
        }),
      })
    );
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTION_ENTRY_CORRECTED' })
    );
  });

  it('correctEntry requires notes (preserves audit trail)', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    // No academic activity in target classroom → allow correction
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);

    const mockCreate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 10 }), create: mockCreate },
        student: { update: vi.fn() },
        promotionEntry: { update: vi.fn() },
      })
    );

    await svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Correct enrollment' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          notes: 'Correct enrollment',
        }),
      })
    );
  });

  it('correctEntry fails for non-COMPLETED batch', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.DRAFT, entries: [mkEntry(101, PromotionDecision.PROMOTED)] })
    );
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Test correction' })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('correctEntry fails for unknown entryId', async () => {
    const completed = mkBatch({
      status: BatchStatus.COMPLETED,
      entries: [mkEntry(101, PromotionDecision.PROMOTED)],
    });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    await expect(
      svc.correctEntry(DIRECTOR, 1, 99999, { targetClassroomId: 2, notes: 'Test correction' })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ── Duplicate enrollment prevention ──────────────────────────────────────────

describe('duplicate enrollment prevention', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('source-year enrollment uses UPSERT (not create) to avoid duplicates', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [entry] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'A', lastName: 'B' });

    const mockUpsert = vi.fn().mockResolvedValue({ id: 10 });
    const mockCreate = vi.fn().mockResolvedValue({});
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: vi.fn() },
        studentEnrollment: { upsert: mockUpsert, create: mockCreate },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
        promotionBatch: { update: vi.fn() },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);

    // Source enrollment uses upsert (idempotent on re-run)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId_academicYear: expect.objectContaining({ academicYear: '2026/27' }),
        }),
      })
    );
  });

  it('same-year promotion is blocked at submit (targetYear === sourceYear)', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({
        status: BatchStatus.DRAFT,
        sourceAcademicYear: '2026/27',
        targetAcademicYear: '2026/27', // same year
        entries: [entry],
      })
    );
    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('same-year promotion is also blocked at approval as final guard', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({
        status: BatchStatus.SUBMITTED,
        sourceAcademicYear: '2026/27',
        targetAcademicYear: '2026/27',
        entries: [entry],
      })
    );
    await expect(svc.approveBatch(DIRECTOR, 1)).rejects.toBeInstanceOf(BadRequestError);
  });
});

// ── Transaction rollback ──────────────────────────────────────────────────────

describe('transaction rollback on failure', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('approveBatch throws and does not mark batch COMPLETED when transaction fails', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(submitted);
    // Simulate transaction failure
    (prisma.$transaction as Mock).mockRejectedValue(new Error('DB connection lost'));

    await expect(svc.approveBatch(DIRECTOR, 1)).rejects.toThrow('DB connection lost');
    // Batch update (COMPLETED) should NOT have been called outside the transaction
    expect(prisma.promotionBatch.update).not.toHaveBeenCalled();
  });

  it('correctEntry throws and does not corrupt enrollment when transaction fails', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    // No academic activity → pass the guard, then fail in transaction
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockRejectedValue(new Error('Deadlock detected'));

    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'test' })
    ).rejects.toThrow('Deadlock detected');
  });
});

// ── Batch summary counts ──────────────────────────────────────────────────────

describe('batch summary counts', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.resetAllMocks(); });

  it('summary correctly counts promoted, repeated, graduated, pending, corrected, unassigned', async () => {
    // Build entries as explicit objects to avoid any enum comparison issues
    const mkSimpleEntry = (
      sid: number,
      decision: string,
      eligibilityStatus: string,
      targetClassroomId: number | null,
      overrideReason: string | null = null
    ) => ({
      id: sid * 100, batchId: 1, studentId: sid,
      decision,
      eligibilityStatus,
      targetClassroomId,
      overrideReason,
      averageMark: '74.00', attendancePercent: null,
      createdAt: new Date(), updatedAt: new Date(),
      student: { studentId: sid, userId: 200 + sid, classroomId: 1, admissionNumber: 'X', firstName: 'S', lastName: String(sid) },
      targetClassroom: targetClassroomId ? CL10A : null,
    });

    const entries = [
      mkSimpleEntry(101, 'PROMOTED',  'ELIGIBLE',       2,    null),     // promoted, assigned
      mkSimpleEntry(102, 'REPEATED',  'NOT_ELIGIBLE',   3,    null),     // repeated, assigned
      mkSimpleEntry(103, 'GRADUATED', 'ELIGIBLE',       null, null),     // graduated
      mkSimpleEntry(104, 'PROMOTED',  'PENDING_REVIEW', null, 'Manual'), // promoted, unassigned, corrected
      mkSimpleEntry(105, 'PROMOTED',  'ELIGIBLE',       null, null),     // promoted, unassigned
    ];

    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ entries }));

    const result = await svc.getBatchById(1);
    // Verify entry count first to ensure mock is working
    expect(result.entries.length).toBe(5);
    expect(result.promotedCount).toBe(3);    // 101, 104, 105
    expect(result.repeatedCount).toBe(1);    // 102
    expect(result.graduatedCount).toBe(1);   // 103
    expect(result.pendingCount).toBe(1);     // 104
    expect(result.correctedCount).toBe(1);   // 104 (has overrideReason)
    expect(result.unassignedCount).toBe(2);  // 104, 105 (PROMOTED, no classroom)
    expect(result.eligibleCount).toBe(3);    // 101, 103, 105
    expect(result.notEligibleCount).toBe(1); // 102
  });
});

// ── Audit history preservation ────────────────────────────────────────────────

describe('audit history preserved', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.resetAllMocks(); });

  it('approveBatch records PROMOTION_BATCH_APPROVED audit entry', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [entry] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'A', lastName: 'B' });
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: vi.fn() },
        studentEnrollment: { upsert: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
        promotionBatch: { update: vi.fn() },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_BATCH_APPROVED',
        userId: DIRECTOR.userId,
      })
    );
  });

  it('correctEntry records PROMOTION_ENTRY_CORRECTED audit entry', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        student: { update: vi.fn() },
        promotionEntry: { update: vi.fn() },
      })
    );

    await svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Correction' });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_ENTRY_CORRECTED',
        userId: DIRECTOR.userId,
      })
    );
  });

  it('recalculateBatch records PROMOTION_BATCH_RECALCULATED audit entry', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.PENDING_REVIEW, 2);
    const draftBatch = mkBatch({ entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(draftBatch)
      .mockResolvedValueOnce(draftBatch);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: '50.00' });
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.promotionEntry.update as Mock).mockResolvedValue({});

    await svc.recalculateBatch(VICE_DIR, 1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTION_BATCH_RECALCULATED' })
    );
  });
});

// ── Production-readiness audit tests ─────────────────────────────────────────
// Issues found during audit and the fixes applied:
//
// ISSUE-1: correctEntry notes was optional — mandatory correction reason
//          is now enforced at both the Zod schema and service level.
// ISSUE-2: correctEntry audit log was missing before/after classroom info.
//          Fixed to include previousClassroomId, previousClassroomLabel,
//          newClassroomLabel, targetAcademicYear, and correctionReason.
// ISSUE-3: correctEntry had no academic-activity guard — if the student
//          already had grades or attendance in the new classroom the
//          correction was silently allowed. Now blocked with a clear error.
// ISSUE-4: submitBatch did not block PENDING_REVIEW entries that had no
//          override reason. Now blocked.
// ISSUE-5: updateEntry had no audit log. Now records PROMOTION_ENTRY_UPDATED
//          with before/after decision and classroom info.

describe('audit: mandatory notes enforcement on correction', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('correctEntry throws BadRequestError when notes is an empty string', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);

    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: '   ' }) // whitespace only
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('audit: correctEntry audit log includes before/after classroom info', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.resetAllMocks(); });

  it('records previousClassroomId, newClassroomId, targetAcademicYear, and correctionReason', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    // entry.targetClassroom = CL10A (classroomId=2)
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    // Target is now CL9B (classroomId=3) — correcting to a different section
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9B); // new target
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        student: { update: vi.fn() },
        promotionEntry: { update: vi.fn() },
      })
    );

    await svc.correctEntry(DIRECTOR, 1, 10100, {
      targetClassroomId: 3,
      notes: 'Grade 10 A was full — moved to Grade 9 B',
    });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_ENTRY_CORRECTED',
        metadata: expect.objectContaining({
          previousClassroomId: 2,
          newClassroomId: 3,
          targetAcademicYear: '2027/28',
          correctionReason: 'Grade 10 A was full — moved to Grade 9 B',
        }),
      })
    );
  });
});

describe('audit: academic-activity guard blocks correction when student has existing records', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('blocks correction when student has grade entries in the target classroom', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    // Student already has grade activity in the new classroom
    (prisma.gradeComponent.count as Mock).mockResolvedValue(3);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);

    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Correction' })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('blocks correction when student has attendance records in the target classroom', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    // Student has attendance records
    (prisma.attendance.count as Mock).mockResolvedValue(5);

    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Correction' })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('allows correction when there is no academic activity in the target classroom', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        student: { update: vi.fn() },
        promotionEntry: { update: vi.fn() },
      })
    );

    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Correction allowed' })
    ).resolves.toBeDefined();
  });
});

describe('audit: submitBatch blocks PENDING_REVIEW entries without override', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('throws BadRequestError when a PENDING_REVIEW entry has no override reason', async () => {
    const pendingEntry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.PENDING_REVIEW, 2);
    // overrideReason is null — no manual review done
    const batch = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [pendingEntry],
    });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(batch);

    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('allows submit when PENDING_REVIEW entry has an override reason (manually reviewed)', async () => {
    const pendingEntry = {
      ...mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.PENDING_REVIEW, 2),
      overrideReason: 'Director reviewed manually — S2 results submitted late',
    };
    const submitted = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [pendingEntry],
    });
    const afterSubmit = { ...submitted, status: BatchStatus.SUBMITTED };
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(afterSubmit);
    (prisma.promotionBatch.update as Mock).mockResolvedValue({});

    const result = await svc.submitBatch(VICE_DIR, 1);
    expect(result.status).toBe(BatchStatus.SUBMITTED);
  });

  it('allows submit when all entries are ELIGIBLE (no pending)', async () => {
    const eligibleEntry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [eligibleEntry],
    });
    const afterSubmit = { ...submitted, status: BatchStatus.SUBMITTED };
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(afterSubmit);
    (prisma.promotionBatch.update as Mock).mockResolvedValue({});

    const result = await svc.submitBatch(VICE_DIR, 1);
    expect(result.status).toBe(BatchStatus.SUBMITTED);
  });
});

describe('audit: updateEntry records audit log with before/after state', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('records PROMOTION_ENTRY_UPDATED with previous and new decision', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const after  = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.ELIGIBLE, 3);
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(mkBatch({ entries: [entry] }))
      .mockResolvedValueOnce(mkBatch({ entries: [after] }));
    (prisma.classroom.findUnique as Mock).mockResolvedValue({ ...CL9B, academicYear: '2027/28' });
    (prisma.promotionEntry.update as Mock).mockResolvedValue({});

    await svc.updateEntry(VICE_DIR, 1, 10100, {
      decision: PromotionDecision.REPEATED,
      targetClassroomId: 3,
      overrideReason: 'Academic support needed',
    });

    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_ENTRY_UPDATED',
        metadata: expect.objectContaining({
          previousDecision: PromotionDecision.PROMOTED,
          newDecision: PromotionDecision.REPEATED,
          overrideReason: 'Academic support needed',
        }),
      })
    );
  });
});

describe('audit: RBAC — unauthorized roles are blocked', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  // Note: role enforcement is done in the route middleware (authorizeWithPermissions),
  // not the service itself. These tests verify that the service correctly uses
  // the `actor` parameter so that route-level auth is meaningful.
  // Specifically, approveBatch and correctEntry record actor.userId in the audit
  // log — confirming the actor identity is tracked through.

  it('approveBatch records the approving Director user ID in the audit log', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [entry] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(submitted)
      .mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'A', lastName: 'B' });
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        student: { update: vi.fn() },
        studentEnrollment: { upsert: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
        promotionBatch: { update: vi.fn() },
      })
    );

    await svc.approveBatch(DIRECTOR, 1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_BATCH_APPROVED',
        userId: 30, // DIRECTOR.userId
      })
    );
  });

  it('correctEntry records correcting user ID in the audit log', async () => {
    const entry = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [entry] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(completed)
      .mockResolvedValueOnce(completed);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn: any) =>
      fn({
        studentEnrollment: { updateMany: vi.fn(), findFirst: vi.fn().mockResolvedValue({ id: 1 }), create: vi.fn() },
        student: { update: vi.fn() },
        promotionEntry: { update: vi.fn() },
      })
    );

    await svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Corrected by Director' });
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROMOTION_ENTRY_CORRECTED',
        userId: 30, // DIRECTOR.userId
        metadata: expect.objectContaining({ correctedByUserId: 30 }),
      })
    );
  });
});
