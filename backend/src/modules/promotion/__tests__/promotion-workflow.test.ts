/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.7b — Promotion Service: Workflow Tests
 *
 * Covers methods not tested in promotion.service.test.ts:
 *  - listBatches
 *  - getBatchById
 *  - submitBatch
 *  - approveBatch
 *  - bulkAssignClassroom
 *  - correctEntry
 *  - getStudentEnrollmentHistory
 *
 * DATABASE SAFETY: all Prisma calls mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { PromotionService } from '../promotion.service';
import { BatchStatus, EligibilityStatus, PromotionDecision } from '@prisma/client';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    classroom:           { findUnique: vi.fn(), findMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    promotionBatch:      { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
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

const DIRECTOR  = { userId: 30, role: 'DIRECTOR'      as const, username: 'd1' };
const VICE_DIR  = { userId: 20, role: 'VICE_DIRECTOR'  as const, username: 'vd1' };

const CL9A  = { classroomId: 1, className: 'Grade 9',  section: 'A', academicYear: '2026/27' };
const CL10A = { classroomId: 2, className: 'Grade 10', section: 'A', academicYear: '2027/28' };
const CL12A = { classroomId: 5, className: 'Grade 12', section: 'A', academicYear: '2026/27' };

const STU1 = { studentId: 101, classroomId: 1, userId: 201, admissionNumber: 'DSH-001', firstName: 'Alice', lastName: 'Bekele', studentStatus: 'ACTIVE' };
const STU2 = { studentId: 102, classroomId: 1, userId: 202, admissionNumber: 'DSH-002', firstName: 'Bob',   lastName: 'Tadesse', studentStatus: 'ACTIVE' };

const PREPARED_BY = { userId: 20, username: 'vd1', director: null, viceDirector: { firstName: 'V', lastName: 'D' }, administrator: null };

function mkEntry(sid: number, dec: PromotionDecision, elig = EligibilityStatus.ELIGIBLE, tcId: number | null = 2) {
  return {
    id: sid * 100, batchId: 1, studentId: sid, decision: dec, eligibilityStatus: elig,
    targetClassroomId: tcId, averageMark: '75.00', attendancePercent: '95.00', overrideReason: null,
    createdAt: new Date(), updatedAt: new Date(),
    student: { studentId: sid, userId: 200 + sid, classroomId: 1, admissionNumber: 'DSH-00' + sid,
               firstName: 'Stu', lastName: String(sid) },
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

// ── listBatches ───────────────────────────────────────────────────────────────

describe('listBatches', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('returns items and pagination meta', async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([mkBatch()]);
    (prisma.promotionBatch.count as Mock).mockResolvedValue(1);
    const r = await svc.listBatches({ page: 1, limit: 20 });
    expect(r.items).toHaveLength(1);
    expect(r.meta.totalItems).toBe(1);
  });

  it('returns empty when no batches', async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([]);
    (prisma.promotionBatch.count as Mock).mockResolvedValue(0);
    const r = await svc.listBatches({ page: 1, limit: 20 });
    expect(r.items).toHaveLength(0);
  });

  it('filters by status when provided', async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([]);
    (prisma.promotionBatch.count as Mock).mockResolvedValue(0);
    await svc.listBatches({ page: 1, limit: 10, status: BatchStatus.SUBMITTED });
    const where = (prisma.promotionBatch.findMany as Mock).mock.calls[0][0].where;
    expect(where.status).toBe(BatchStatus.SUBMITTED);
  });

  it('filters by sourceClassroomId when provided', async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([]);
    (prisma.promotionBatch.count as Mock).mockResolvedValue(0);
    await svc.listBatches({ page: 1, limit: 10, sourceClassroomId: 1 });
    const where = (prisma.promotionBatch.findMany as Mock).mock.calls[0][0].where;
    expect(where.sourceClassroomId).toBe(1);
  });

  it('orders by createdAt desc', async () => {
    (prisma.promotionBatch.findMany as Mock).mockResolvedValue([]);
    (prisma.promotionBatch.count as Mock).mockResolvedValue(0);
    await svc.listBatches({ page: 1, limit: 10 });
    const orderBy = (prisma.promotionBatch.findMany as Mock).mock.calls[0][0].orderBy;
    expect(orderBy).toEqual({ createdAt: 'desc' });
  });
});

// ── getBatchById ──────────────────────────────────────────────────────────────

describe('getBatchById', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('returns batch detail DTO', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ id: 42 }));
    const r = await svc.getBatchById(42);
    expect(r.id).toBe(42);
    expect(r.status).toBe(BatchStatus.DRAFT);
  });

  it('throws NotFoundError when batch does not exist', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.getBatchById(999)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── submitBatch ───────────────────────────────────────────────────────────────

describe('submitBatch', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('submits a DRAFT batch with all entries having target classrooms', async () => {
    const batch = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [
        mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2),
        mkEntry(102, PromotionDecision.REPEATED,  EligibilityStatus.ELIGIBLE, 2),
      ],
    });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({ ...batch, status: BatchStatus.SUBMITTED });
    (prisma.promotionBatch.update as Mock).mockResolvedValue({});

    const r = await svc.submitBatch(VICE_DIR, 1);
    expect(r.status).toBe(BatchStatus.SUBMITTED);
    expect(prisma.promotionBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BatchStatus.SUBMITTED }) })
    );
  });

  it('throws BadRequestError when a PROMOTED entry has no target classroom', async () => {
    const batch = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, null)],
    });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(batch);
    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws BadRequestError when a REPEATED entry has no target classroom', async () => {
    const batch = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.ELIGIBLE, null)],
    });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(batch);
    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('calls recordAudit after successful submit', async () => {
    const batch = mkBatch({ status: BatchStatus.DRAFT, entries: [] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({ ...batch, status: BatchStatus.SUBMITTED });
    (prisma.promotionBatch.update as Mock).mockResolvedValue({});
    await svc.submitBatch(VICE_DIR, 1);
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTION_BATCH_SUBMITTED' })
    );
  });

  it('throws BadRequestError when batch is not DRAFT', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.COMPLETED })
    );
    await expect(svc.submitBatch(VICE_DIR, 1)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ── approveBatch ──────────────────────────────────────────────────────────────

describe('approveBatch', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('throws BadRequestError when batch is not SUBMITTED', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.DRAFT })
    );
    await expect(svc.approveBatch(DIRECTOR, 1)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('executes transaction and calls recordAudit for SUBMITTED batch', async () => {
    const batch = mkBatch({
      status: BatchStatus.SUBMITTED,
      entries: [mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2)],
    });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({ ...batch, status: BatchStatus.COMPLETED });
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      // Provide enough of a mock tx to get through without errors
      const mockTx = {
        student: { update: vi.fn().mockResolvedValue({}) },
        studentEnrollment: {
          upsert: vi.fn().mockResolvedValue({ id: 1 }),
          create: vi.fn().mockResolvedValue({}),
        },
        classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
        promotionBatch: { update: vi.fn().mockResolvedValue({}) },
      };
      await fn(mockTx);
    });
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'Alice', lastName: 'A' });

    const r = await svc.approveBatch(DIRECTOR, 1);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTION_BATCH_APPROVED' })
    );
    expect(r.status).toBe(BatchStatus.COMPLETED);
  });

  it('handles GRADUATED entries without assigning a new classroom', async () => {
    const batch = mkBatch({
      status: BatchStatus.SUBMITTED,
      sourceClassroom: CL12A,
      entries: [mkEntry(101, PromotionDecision.GRADUATED, EligibilityStatus.ELIGIBLE, null)],
    });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({ ...batch, status: BatchStatus.COMPLETED });

    const mockTx = {
      student: { update: vi.fn().mockResolvedValue({}) },
      studentEnrollment: {
        upsert: vi.fn().mockResolvedValue({ id: 1 }),
        create: vi.fn().mockResolvedValue({}),
      },
      promotionBatch: { update: vi.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(mockTx));
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'Alice', lastName: 'A' });

    await expect(svc.approveBatch(DIRECTOR, 1)).resolves.not.toThrow();
    // For GRADUATED, classroom.findUniqueOrThrow should NOT have been called
    expect(mockTx.studentEnrollment.upsert).toHaveBeenCalled();
  });
});

// ── bulkAssignClassroom ───────────────────────────────────────────────────────

describe('bulkAssignClassroom', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('assigns target classroom to all PROMOTED entries', async () => {
    const batch = mkBatch({
      status: BatchStatus.DRAFT,
      entries: [
        mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, null),
        mkEntry(102, PromotionDecision.REPEATED,  EligibilityStatus.ELIGIBLE, null),
      ],
    });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({ ...batch });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.promotionEntry.updateMany as Mock).mockResolvedValue({ count: 1 });

    await svc.bulkAssignClassroom(VICE_DIR, 1, { targetClassroomId: 2 });
    expect(prisma.promotionEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ batchId: 1, decision: PromotionDecision.PROMOTED }),
        data: { targetClassroomId: 2 },
      })
    );
  });

  it('throws NotFoundError when target classroom does not exist', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ status: BatchStatus.DRAFT }));
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.bulkAssignClassroom(VICE_DIR, 1, { targetClassroomId: 999 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws BadRequestError when target classroom is in wrong academic year', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.DRAFT, targetAcademicYear: '2027/28' })
    );
    // Classroom in wrong year
    (prisma.classroom.findUnique as Mock).mockResolvedValue({ ...CL10A, academicYear: '2025/26' });
    await expect(
      svc.bulkAssignClassroom(VICE_DIR, 1, { targetClassroomId: 2 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws BadRequestError when batch is not editable', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.COMPLETED }) // COMPLETED = not editable
    );
    await expect(
      svc.bulkAssignClassroom(VICE_DIR, 1, { targetClassroomId: 2 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('respects onlyDecision filter when provided', async () => {
    const batch = mkBatch({ status: BatchStatus.DRAFT, entries: [] });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(batch);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    (prisma.promotionEntry.updateMany as Mock).mockResolvedValue({ count: 0 });

    await svc.bulkAssignClassroom(VICE_DIR, 1, {
      targetClassroomId: 2,
      onlyDecision: PromotionDecision.REPEATED,
    });
    expect(prisma.promotionEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ decision: PromotionDecision.REPEATED }),
      })
    );
  });
});

// ── correctEntry ──────────────────────────────────────────────────────────────

describe('correctEntry', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('corrects a COMPLETED batch entry and calls recordAudit', async () => {
    const batch = mkBatch({
      status: BatchStatus.COMPLETED,
      entries: [mkEntry(101, PromotionDecision.PROMOTED)],
    });
    (prisma.promotionBatch.findUnique as Mock)
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(batch);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    // No academic activity in target classroom → allow correction
    (prisma.gradeComponent.count as Mock).mockResolvedValue(0);
    (prisma.subjectFinalization.count as Mock).mockResolvedValue(0);
    (prisma.attendance.count as Mock).mockResolvedValue(0);

    const mockTx = {
      studentEnrollment: {
        updateMany: vi.fn().mockResolvedValue({}),
        findFirst:  vi.fn().mockResolvedValue({ id: 10 }),
        create:     vi.fn().mockResolvedValue({}),
      },
      student:       { update: vi.fn().mockResolvedValue({}) },
      promotionEntry: { update: vi.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<void>) => fn(mockTx));

    await svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Wrong classroom' });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROMOTION_ENTRY_CORRECTED' })
    );
  });

  it('throws BadRequestError when batch is not COMPLETED', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.DRAFT, entries: [] })
    );
    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 2, notes: 'Test correction' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when entry does not exist in batch', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(
      mkBatch({ status: BatchStatus.COMPLETED, entries: [mkEntry(101, PromotionDecision.PROMOTED)] })
    );
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL10A);
    await expect(
      svc.correctEntry(DIRECTOR, 1, 99999, { targetClassroomId: 2, notes: 'Test correction' }) // wrong entryId
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws NotFoundError when target classroom does not exist', async () => {
    const batch = mkBatch({
      status: BatchStatus.COMPLETED,
      entries: [mkEntry(101, PromotionDecision.PROMOTED)],
    });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(batch);
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.correctEntry(DIRECTOR, 1, 10100, { targetClassroomId: 999, notes: 'Test correction' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── getStudentEnrollmentHistory ───────────────────────────────────────────────

describe('getStudentEnrollmentHistory', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('returns ordered enrollment history for a student', async () => {
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([
      {
        id: 1, studentId: 101, classroomId: 1, academicYear: '2025/26',
        decision: 'PROMOTED', batchId: 1, notes: null,
        createdAt: new Date('2026-07-01'),
        classroom: CL9A,
      },
      {
        id: 2, studentId: 101, classroomId: 2, academicYear: '2026/27',
        decision: 'ACTIVE', batchId: 1, notes: null,
        createdAt: new Date('2026-07-01'),
        classroom: CL10A,
      },
    ]);

    const r = await svc.getStudentEnrollmentHistory(101);
    expect(r).toHaveLength(2);
    expect(r[0].academicYear).toBe('2025/26');
    expect(r[0].decision).toBe('PROMOTED');
    expect(r[1].classroomId).toBe(2);
  });

  it('returns empty array when student has no enrollment records', async () => {
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    const r = await svc.getStudentEnrollmentHistory(101);
    expect(r).toHaveLength(0);
  });

  it('queries by studentId and orders by academicYear asc', async () => {
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([]);
    await svc.getStudentEnrollmentHistory(42);
    const call = (prisma.studentEnrollment.findMany as Mock).mock.calls[0][0];
    expect(call.where.studentId).toBe(42);
    expect(call.orderBy).toEqual({ academicYear: 'asc' });
  });

  it('each DTO has classroomLabel field', async () => {
    (prisma.studentEnrollment.findMany as Mock).mockResolvedValue([{
      id: 1, studentId: 101, classroomId: 1, academicYear: '2026/27',
      decision: 'ACTIVE', batchId: null, notes: null,
      createdAt: new Date(),
      classroom: CL9A,
    }]);
    const r = await svc.getStudentEnrollmentHistory(101);
    expect(typeof r[0].classroomLabel).toBe('string');
    expect(r[0].classroomLabel).toContain('Grade 9');
  });
});
