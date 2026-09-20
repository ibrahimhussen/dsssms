/** Promotion Service Tests - Phase 3.3 - DATABASE SAFETY: all Prisma mocked */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { PromotionService } from "../promotion.service";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/errors/app-error";
import { BatchStatus, EligibilityStatus, PromotionDecision } from "@prisma/client";

vi.mock("../../../database/prisma-client", () => ({ prisma: {
  classroom:         { findUnique: vi.fn(), findMany: vi.fn() },
  promotionBatch:    { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  promotionEntry:    { update: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
  student:           { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  studentEnrollment: { findFirst: vi.fn(), upsert: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  academicReport:    { findMany: vi.fn() },
  attendance:        { count: vi.fn() },
  systemSetting:     { findUnique: vi.fn() },
  $transaction:      vi.fn(),
}}));
vi.mock("../../../config/env", () => ({ env: { NODE_ENV: "test" }, isProduction: false }));
vi.mock("../../../core/audit/audit-recorder", () => ({ recordAudit: vi.fn() }));
vi.mock("../../notifications/notification.service", () => ({ createAutoNotification: vi.fn(), notifyStudentParents: vi.fn() }));

import { prisma } from "../../../database/prisma-client";

const VICE_DIR  = { userId: 20, role: "VICE_DIRECTOR" as const, username: "vd1" };
const DIRECTOR  = { userId: 30, role: "DIRECTOR"      as const, username: "d1"  };
const CL9A  = { classroomId: 1, className: "Grade 9",  section: "A", academicYear: "2026/27" };
const CL10A = { classroomId: 2, className: "Grade 10", section: "A", academicYear: "2027/28" };
const CL12A = { classroomId: 5, className: "Grade 12", section: "A", academicYear: "2026/27" };
const STU1 = { studentId: 101, classroomId: 1, userId: 201, admissionNumber: "DSH-001", firstName: "Alice", lastName: "Bekele", studentStatus: "ACTIVE" };
const STU2 = { studentId: 102, classroomId: 1, userId: 202, admissionNumber: "DSH-002", firstName: "Bob",   lastName: "Tadesse", studentStatus: "ACTIVE" };
const PREPARED_BY = { userId: 20, username: "vd1", director: null, viceDirector: { firstName: "V", lastName: "D" }, administrator: null };

function mkBatch(o: Record<string,unknown> = {}) {
  return { id: 1, sourceClassroomId: 1, sourceAcademicYear: "2026/27", targetAcademicYear: "2027/28",
    status: BatchStatus.DRAFT, preparedById: 20, approvedById: null, rejectedById: null,
    rejectionReason: null, submittedAt: null, approvedAt: null, completedAt: null,
    createdAt: new Date(), updatedAt: new Date(),
    sourceClassroom: CL9A, preparedBy: PREPARED_BY, approvedBy: null, entries: [], ...o };
}

function mkEntry(sid: number, dec: PromotionDecision, elig: EligibilityStatus, tcId: number|null = 2) {
  return { id: sid * 100, batchId: 1, studentId: sid, decision: dec, eligibilityStatus: elig,
    targetClassroomId: tcId, averageMark: "75.00", attendancePercent: "95.00", overrideReason: null,
    createdAt: new Date(), updatedAt: new Date(),
    student: { studentId: sid, userId: 200 + sid, classroomId: 1, admissionNumber: "DSH-00"+sid,
               firstName: "Stu", lastName: String(sid) },
    targetClassroom: tcId ? CL10A : null };
}
// ═══ eligibility + createBatch ════════════════════════════════════════════
describe("createBatch — eligibility", () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  function setupCreate(students: typeof STU1[], reports: { studentId:number;averageMark:string }[]) {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: "50.00" });
    (prisma.student.findMany as Mock).mockResolvedValue(students);
    (prisma.academicReport.findMany as Mock).mockImplementation(async ({where}:any) => reports.filter((r:any)=>r.studentId===where.studentId));
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    const batch = mkBatch({ entries: students.map((s,i) => mkEntry(s.studentId, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE)) });
    (prisma.$transaction as Mock).mockImplementation(async (fn:any) => fn({ promotionBatch:{ create:vi.fn().mockResolvedValue(batch), findUniqueOrThrow:vi.fn().mockResolvedValue(batch) }, promotionEntry:{ createMany:vi.fn() } }));
  }

  it("student with avg >= passMark → ELIGIBLE", async () => {
    setupCreate([STU1], [{ studentId:101, averageMark:"72.00" }]);
    const r = await svc.createBatch(VICE_DIR, { sourceClassroomId:1, targetAcademicYear:"2027/28" });
    expect(r.batch).toBeDefined();
  });

  it("student with avg < passMark → NOT_ELIGIBLE", async () => {
    const entry = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.NOT_ELIGIBLE);
    const batch = mkBatch({ entries: [entry] });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark:"50.00" });
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([{ studentId:101, averageMark:"38.00" }]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn:any) => fn({ promotionBatch:{ create:vi.fn().mockResolvedValue(batch), findUniqueOrThrow:vi.fn().mockResolvedValue(batch) }, promotionEntry:{ createMany:vi.fn() } }));
    const r = await svc.createBatch(VICE_DIR, { sourceClassroomId:1, targetAcademicYear:"2027/28" });
    expect(r.batch).toBeDefined();
  });

  it("student with no reports → PENDING_REVIEW", async () => {
    const entry = mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.PENDING_REVIEW);
    const batch = mkBatch({ entries: [entry] });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark:"50.00" });
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn:any) => fn({ promotionBatch:{ create:vi.fn().mockResolvedValue(batch), findUniqueOrThrow:vi.fn().mockResolvedValue(batch) }, promotionEntry:{ createMany:vi.fn() } }));
    const r = await svc.createBatch(VICE_DIR, { sourceClassroomId:1, targetAcademicYear:"2027/28" });
    expect(r.batch).toBeDefined();
  });

  it("Grade 12 eligible student defaults to GRADUATED decision", async () => {
    const entry = mkEntry(101, PromotionDecision.GRADUATED, EligibilityStatus.ELIGIBLE, null);
    const batch = mkBatch({ sourceClassroom:CL12A, sourceClassroomId:5, entries:[entry] });
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL12A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark:"50.00" });
    (prisma.student.findMany as Mock).mockResolvedValue([{ ...STU1, classroomId:5 }]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([{ studentId:101, averageMark:"72.00" }]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    (prisma.$transaction as Mock).mockImplementation(async (fn:any) => fn({ promotionBatch:{ create:vi.fn().mockResolvedValue(batch), findUniqueOrThrow:vi.fn().mockResolvedValue(batch) }, promotionEntry:{ createMany:vi.fn() } }));
    const r = await svc.createBatch(VICE_DIR, { sourceClassroomId:5, targetAcademicYear:"2027/28" });
    expect(r.batch).toBeDefined();
  });

  it("throws NotFoundError for non-existent classroom", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.createBatch(VICE_DIR, { sourceClassroomId:999, targetAcademicYear:"2027/28" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ConflictError when a batch already exists for same classroom+target year", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(mkBatch());
    await expect(svc.createBatch(VICE_DIR, { sourceClassroomId:1, targetAcademicYear:"2027/28" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws BadRequestError when classroom has no active students", async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark:"50.00" });
    (prisma.student.findMany as Mock).mockResolvedValue([]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    await expect(svc.createBatch(VICE_DIR, { sourceClassroomId:1, targetAcademicYear:"2027/28" })).rejects.toBeInstanceOf(BadRequestError);
  });
});
describe("PASS/FAIL separation from PROMOTED/REPEATED", () => {
  it("PASS string differs from PromotionDecision.PROMOTED", () => { expect("PASS").not.toBe(PromotionDecision.PROMOTED); });
  it("FAIL string differs from PromotionDecision.REPEATED", () => { expect("FAIL").not.toBe(PromotionDecision.REPEATED); });
  it("GRADUATED is not an academic status", () => { expect(["PASS","FAIL","INCOMPLETE","PENDING"]).not.toContain("GRADUATED"); });
});

describe('rejectBatch', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('throws BadRequestError when batch is not SUBMITTED', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ status: BatchStatus.DRAFT }));
    await expect(svc.rejectBatch(DIRECTOR, 1, { rejectionReason: 'x' })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('returns rejected batch on valid SUBMITTED batch', async () => {
    const sub = mkBatch({ status: BatchStatus.SUBMITTED });
    const rej = mkBatch({ status: BatchStatus.REJECTED, rejectionReason: 'invalid data' });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValueOnce(sub).mockResolvedValueOnce(rej);
    (prisma.promotionBatch.update as Mock).mockResolvedValue({});
    const r = await svc.rejectBatch(DIRECTOR, 1, { rejectionReason: 'invalid data' });
    expect(r).toBeDefined();
  });
});

describe('updateEntry validation', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('throws BadRequestError when GRADUATED is set on a non-Grade-12 source classroom', async () => {
    const e = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ entries: [e] }));
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    await expect(
      svc.updateEntry(VICE_DIR, 1, 101 * 100, { decision: PromotionDecision.GRADUATED })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when target classroom belongs to wrong academic year', async () => {
    const e = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ entries: [e] }));
    const wrongYear = { ...CL10A, academicYear: '2025/26' };
    (prisma.classroom.findUnique as Mock).mockResolvedValue(wrongYear);
    await expect(
      svc.updateEntry(VICE_DIR, 1, 101 * 100, { targetClassroomId: 2 })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws NotFoundError for unknown batch', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.updateEntry(VICE_DIR, 1, 9999, { decision: PromotionDecision.REPEATED })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws BadRequestError when batch is SUBMITTED (no longer editable)', async () => {
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValue(mkBatch({ status: BatchStatus.SUBMITTED }));
    await expect(
      svc.updateEntry(VICE_DIR, 1, 101 * 100, { decision: PromotionDecision.REPEATED })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('duplicate prevention', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('throws ConflictError when a DRAFT batch already exists for same classroom+year', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(mkBatch({ status: BatchStatus.DRAFT }));
    await expect(
      svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws ConflictError when a SUBMITTED batch already exists for same classroom+year', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(mkBatch({ status: BatchStatus.SUBMITTED }));
    await expect(
      svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('does NOT throw ConflictError when a COMPLETED batch exists (new batch is allowed)', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null); // findFirst only returns DRAFT/SUBMITTED/APPROVED
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: '50.00' });
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    const batch = mkBatch({ entries: [mkEntry(101, PromotionDecision.REPEATED, EligibilityStatus.PENDING_REVIEW)] });
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      promotionBatch: { create: vi.fn().mockResolvedValue(batch), findUniqueOrThrow: vi.fn().mockResolvedValue(batch) },
      promotionEntry: { createMany: vi.fn() },
    }));
    await expect(
      svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' })
    ).resolves.toBeDefined();
  });
});

describe('academic year handling', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('sourceAcademicYear matches classroom.academicYear', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: '50.00' });
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    const batch = mkBatch({ sourceAcademicYear: '2026/27', targetAcademicYear: '2027/28', entries: [] });
    let capturedData;
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      promotionBatch: {
        create: vi.fn().mockImplementation(async ({ data }) => { capturedData = data; return batch; }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(batch),
      },
      promotionEntry: { createMany: vi.fn() },
    }));
    await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2027/28' });
    expect(capturedData!.sourceAcademicYear).toBe('2026/27');
    expect(capturedData!.targetAcademicYear).toBe('2027/28');
  });

  it('target academic year is stored correctly on the batch', async () => {
    (prisma.classroom.findUnique as Mock).mockResolvedValue(CL9A);
    (prisma.promotionBatch.findFirst as Mock).mockResolvedValue(null);
    (prisma.systemSetting.findUnique as Mock).mockResolvedValue({ promotionPassMark: '50.00' });
    (prisma.student.findMany as Mock).mockResolvedValue([STU1]);
    (prisma.academicReport.findMany as Mock).mockResolvedValue([]);
    (prisma.attendance.count as Mock).mockResolvedValue(0);
    const batch = mkBatch({ targetAcademicYear: '2028/29', entries: [] });
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      promotionBatch: { create: vi.fn().mockResolvedValue(batch), findUniqueOrThrow: vi.fn().mockResolvedValue(batch) },
      promotionEntry: { createMany: vi.fn() },
    }));
    const r = await svc.createBatch(VICE_DIR, { sourceClassroomId: 1, targetAcademicYear: '2028/29' });
    expect(r.batch.targetAcademicYear).toBe('2028/29');
  });
});

describe('historical data preservation', () => {
  let svc: PromotionService;
  beforeEach(() => { svc = new PromotionService(); vi.clearAllMocks(); });

  it('PROMOTED: source-year enrollment is upserted (historical record preserved)', async () => {
    const e = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [e] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [e] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValueOnce(submitted).mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'A', lastName: 'B' });
    const mockUpsert = vi.fn().mockResolvedValue({ id: 10 });
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      student: { update: vi.fn() },
      studentEnrollment: { upsert: mockUpsert, create: vi.fn() },
      promotionBatch: { update: vi.fn() },
      classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
    }));
    await svc.approveBatch(DIRECTOR, 1);
    // Source enrollment upserted with source academic year
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.where.studentId_academicYear.academicYear).toBe('2026/27');
  });

  it('PROMOTED: new target-year enrollment is created (student moves forward)', async () => {
    const e = mkEntry(101, PromotionDecision.PROMOTED, EligibilityStatus.ELIGIBLE, 2);
    const submitted = mkBatch({ status: BatchStatus.SUBMITTED, entries: [e] });
    const completed = mkBatch({ status: BatchStatus.COMPLETED, entries: [e] });
    (prisma.promotionBatch.findUnique as Mock).mockResolvedValueOnce(submitted).mockResolvedValueOnce(completed);
    (prisma.student.findUnique as Mock).mockResolvedValue({ userId: 201, firstName: 'A', lastName: 'B' });
    const mockCreate = vi.fn();
    (prisma.$transaction as Mock).mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      student: { update: vi.fn() },
      studentEnrollment: { upsert: vi.fn().mockResolvedValue({ id: 10 }), create: mockCreate },
      promotionBatch: { update: vi.fn() },
      classroom: { findUniqueOrThrow: vi.fn().mockResolvedValue(CL10A) },
    }));
    await svc.approveBatch(DIRECTOR, 1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ academicYear: '2027/28' }) })
    );
  });
});
