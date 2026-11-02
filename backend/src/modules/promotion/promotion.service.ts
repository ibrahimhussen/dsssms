import { BatchStatus, EligibilityStatus, EnrollmentDecision, Prisma, PromotionDecision } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { recordAudit } from '../../core/audit/audit-recorder';
import { createAutoNotification, notifyStudentParents } from '../notifications/notification.service';
import { NotificationCategory } from '@prisma/client';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CreateBatchInput,
  UpdateEntryInput,
  BulkAssignClassroomInput,
  RejectBatchInput,
  CorrectEntryInput,
  ListBatchesQuery,
} from './validation/promotion.validation';
import {
  CreateBatchResultDto,
  PromotionBatchDetailDto,
  PromotionBatchSummaryDto,
  PromotionEntryDto,
  StudentEnrollmentDto,
} from './dto/promotion.dto';

// ── Prisma include shapes ─────────────────────────────────────────────────────

const BATCH_INCLUDE = {
  sourceClassroom: true,
  preparedBy: { include: { director: true, viceDirector: true, administrator: true } },
  approvedBy: { include: { director: true } },
  entries: {
    include: {
      student: true,
      targetClassroom: true,
    },
    orderBy: { student: { lastName: 'asc' } } as const,
  },
} satisfies Prisma.PromotionBatchInclude;

type BatchWithRelations = Prisma.PromotionBatchGetPayload<{ include: typeof BATCH_INCLUDE }>;
type EntryWithRelations = BatchWithRelations['entries'][number];

// ── Mappers ───────────────────────────────────────────────────────────────────

function classroomLabel(c: { className: string; section: string; academicYear: string }): string {
  return `${c.className} ${c.section} (${c.academicYear})`;
}

function resolveUserName(user: {
  username: string;
  director: { firstName: string; lastName: string } | null;
  viceDirector: { firstName: string; lastName: string } | null;
  administrator: { firstName: string; lastName: string } | null;
}): string {
  const profile = user.director ?? user.viceDirector ?? user.administrator;
  return profile ? `${profile.firstName} ${profile.lastName}` : user.username;
}

function eligibilityReasonForEntry(
  entry: EntryWithRelations,
  sourceAcademicYear: string
): string {
  if (entry.eligibilityStatus === EligibilityStatus.ELIGIBLE) {
    return entry.averageMark !== null
      ? `Full-year average ${Number(entry.averageMark)}% meets the promotion requirement.`
      : 'Marked eligible by authorized reviewer.';
  }
  if (entry.eligibilityStatus === EligibilityStatus.NOT_ELIGIBLE) {
    return entry.averageMark !== null
      ? `Full-year average ${Number(entry.averageMark)}% is below the promotion requirement.`
      : 'Marked not eligible.';
  }
  // PENDING_REVIEW — reason depends on what data exists
  if (entry.averageMark === null) {
    return `Semester 1 and Semester 2 results are required for academic year ${sourceAcademicYear}. ` +
      `Please ensure both results are generated, finalized, and available before calculating promotion eligibility.`;
  }
  return `Pending review — manual decision required.`;
}

function toEntryDto(entry: EntryWithRelations, sourceAcademicYear: string): PromotionEntryDto {
  return {
    id: entry.id,
    batchId: entry.batchId,
    studentId: entry.studentId,
    admissionNumber: entry.student.admissionNumber,
    studentName: `${entry.student.firstName} ${entry.student.lastName}`,
    eligibilityStatus: entry.eligibilityStatus,
    decision: entry.decision,
    targetClassroomId: entry.targetClassroomId,
    targetClassroomLabel: entry.targetClassroom ? classroomLabel(entry.targetClassroom) : null,
    averageMark: entry.averageMark !== null ? Number(entry.averageMark) : null,
    attendancePercent: entry.attendancePercent !== null ? Number(entry.attendancePercent) : null,
    overrideReason: entry.overrideReason,
    eligibilityReason: eligibilityReasonForEntry(entry, sourceAcademicYear),
  };
}

function toBatchSummaryDto(batch: BatchWithRelations): PromotionBatchSummaryDto {
  const eligible    = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.ELIGIBLE).length;
  const pending     = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.PENDING_REVIEW).length;
  const notEligible = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.NOT_ELIGIBLE).length;

  // Decision breakdown
  const promotedCount  = batch.entries.filter((e) => e.decision === PromotionDecision.PROMOTED).length;
  const repeatedCount  = batch.entries.filter((e) => e.decision === PromotionDecision.REPEATED).length;
  const graduatedCount = batch.entries.filter((e) => e.decision === PromotionDecision.GRADUATED).length;
  // Corrected = entries that have a non-null overrideReason (manually overridden)
  const correctedCount = batch.entries.filter((e) => e.overrideReason !== null).length;
  // Unassigned = PROMOTED or REPEATED with no target classroom
  const unassignedCount = batch.entries.filter(
    (e) =>
      (e.decision === PromotionDecision.PROMOTED || e.decision === PromotionDecision.REPEATED) &&
      e.targetClassroomId === null
  ).length;

  return {
    id: batch.id,
    sourceAcademicYear: batch.sourceAcademicYear,
    targetAcademicYear: batch.targetAcademicYear,
    sourceClassroomId: batch.sourceClassroomId,
    sourceClassroomLabel: classroomLabel(batch.sourceClassroom),
    status: batch.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preparedBy: resolveUserName(batch.preparedBy as any),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    approvedBy: batch.approvedBy ? resolveUserName(batch.approvedBy as any) : null,
    totalStudents: batch.entries.length,
    eligibleCount: eligible,
    pendingCount: pending,
    notEligibleCount: notEligible,
    promotedCount,
    repeatedCount,
    graduatedCount,
    correctedCount,
    unassignedCount,
    submittedAt: batch.submittedAt?.toISOString() ?? null,
    approvedAt: batch.approvedAt?.toISOString() ?? null,
    completedAt: batch.completedAt?.toISOString() ?? null,
    rejectionReason: batch.rejectionReason,
    createdAt: batch.createdAt.toISOString(),
  };
}

function toBatchDetailDto(batch: BatchWithRelations): PromotionBatchDetailDto {
  return {
    ...toBatchSummaryDto(batch),
    entries: batch.entries.map((e) => toEntryDto(e, batch.sourceAcademicYear)),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertBatchExists(id: number): Promise<BatchWithRelations> {
  const batch = await prisma.promotionBatch.findUnique({ where: { id }, include: BATCH_INCLUDE });
  if (!batch) throw new NotFoundError('Promotion batch');
  return batch;
}

async function assertBatchEditable(batch: BatchWithRelations): Promise<void> {
  if (batch.status !== BatchStatus.DRAFT) {
    throw new BadRequestError(
      `This batch is ${batch.status.toLowerCase()} and can no longer be edited`
    );
  }
}

/** Compute eligibility for one student based on their academic reports and attendance. */
async function computeEligibility(
  studentId: number,
  academicYear: string,
  passMarkDecimal: number
): Promise<{ eligibilityStatus: EligibilityStatus; averageMark: number | null; attendancePercent: number | null; eligibilityReason: string }> {
  // Pull both semester reports for this academic year
  const reports = await prisma.academicReport.findMany({
    where: { studentId, academicYear },
  });

  let averageMark: number | null = null;
  let eligibilityStatus: EligibilityStatus;
  let eligibilityReason: string;

  const s1 = reports.find((r) => r.semester === 'SEMESTER_1');
  const s2 = reports.find((r) => r.semester === 'SEMESTER_2');

  if (reports.length === 0) {
    // No reports at all — both semesters missing
    eligibilityStatus = EligibilityStatus.PENDING_REVIEW;
    eligibilityReason = `Semester 1 and Semester 2 results are missing for academic year ${academicYear}. ` +
      `Please ensure both results are generated, finalized, and available before calculating promotion eligibility.`;
  } else if (!s1 || !s2) {
    // Exactly one semester present
    const missingSemester = !s1 ? 'Semester 1' : 'Semester 2';
    eligibilityStatus = EligibilityStatus.PENDING_REVIEW;
    eligibilityReason = `${missingSemester} result is missing for academic year ${academicYear}. ` +
      `Semester 1 and Semester 2 results are required. ` +
      `Please ensure both results are generated, finalized, and available before calculating promotion eligibility.`;
  } else {
    // Full-year average = (S1 × 0.5) + (S2 × 0.5)
    const s1avg = Number(s1.averageMark);
    const s2avg = Number(s2.averageMark);
    averageMark = Math.round((s1avg * 0.5 + s2avg * 0.5) * 100) / 100;
    if (averageMark >= passMarkDecimal) {
      eligibilityStatus = EligibilityStatus.ELIGIBLE;
      eligibilityReason = `Full-year average ${averageMark}% (S1: ${s1avg}%, S2: ${s2avg}%) meets the promotion requirement (${passMarkDecimal}%).`;
    } else {
      eligibilityStatus = EligibilityStatus.NOT_ELIGIBLE;
      eligibilityReason = `Full-year average ${averageMark}% (S1: ${s1avg}%, S2: ${s2avg}%) is below the promotion requirement (${passMarkDecimal}%).`;
    }
  }

  // Attendance percentage (informational — displayed but not a hard block)
  const [totalAttendance, presentOrLate] = await Promise.all([
    prisma.attendance.count({ where: { studentId, period: 0 } }),
    prisma.attendance.count({
      where: {
        studentId,
        period: 0,
        status: { in: ['PRESENT', 'LATE'] },
      },
    }),
  ]);

  const attendancePercent =
    totalAttendance > 0
      ? Math.round((presentOrLate / totalAttendance) * 10000) / 100
      : null;

  return { eligibilityStatus, averageMark, attendancePercent, eligibilityReason };
}

/**
 * Auto-computes the next academic year from the source year.
 * "2026" → "2027", "2026/27" → "2027/28", "2026/2027" → "2027/2028".
 */
function computeTargetAcademicYear(sourceAcademicYear: string): string {
  const trimmed = sourceAcademicYear.trim();
  // Slash format: "2026/27" or "2026/2027"
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{2,4})$/);
  if (slashMatch) {
    const startYear = parseInt(slashMatch[1], 10);
    const suffixLen = slashMatch[2].length;
    const nextEnd = startYear + 1 + 1; // e.g. 2026+1=2027, next end year is 2028
    return `${startYear + 1}/${String(nextEnd).slice(-suffixLen)}`;
  }
  // Bare year: "2026" → "2027"
  const bareMatch = trimmed.match(/^(\d{4})$/);
  if (bareMatch) {
    return String(parseInt(bareMatch[1], 10) + 1);
  }
  // Unknown format — increment the first 4-digit number if possible
  const anyMatch = trimmed.match(/(\d{4})/);
  if (anyMatch) {
    return trimmed.replace(/(\d{4})/, String(parseInt(anyMatch[1], 10) + 1));
  }
  return trimmed;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PromotionService {
  /**
   * Creates a new DRAFT promotion batch for one source classroom.
   * Automatically loads all active students, computes their eligibility
   * from existing academic reports, and sets default decisions.
   */
  async createBatch(
    actor: AuthenticatedUser,
    input: CreateBatchInput,
    ipAddress?: string
  ): Promise<CreateBatchResultDto> {
    const classroom = await prisma.classroom.findUnique({
      where: { classroomId: input.sourceClassroomId },
    });
    if (!classroom) throw new NotFoundError('Classroom');

    // Auto-compute target academic year if the operator entered the same year as source
    const targetAcademicYear =
      input.targetAcademicYear.trim() === classroom.academicYear
        ? computeTargetAcademicYear(classroom.academicYear)
        : input.targetAcademicYear.trim();

    // Prevent duplicate DRAFT / SUBMITTED batches for the same source classroom → target year
    const existing = await prisma.promotionBatch.findFirst({
      where: {
        sourceClassroomId: input.sourceClassroomId,
        targetAcademicYear,
        status: { in: [BatchStatus.DRAFT, BatchStatus.SUBMITTED, BatchStatus.APPROVED] },
      },
    });
    if (existing) {
      throw new ConflictError(
        `A promotion batch for this classroom to ${targetAcademicYear} already exists (status: ${existing.status})`
      );
    }

    // Fetch pass mark from system settings (default 50 if not set)
    const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    const passMarkDecimal = settings ? Number(settings.promotionPassMark) : 50;

    // Load all ACTIVE students in this classroom
    const students = await prisma.student.findMany({
      where: { classroomId: input.sourceClassroomId, studentStatus: 'ACTIVE' },
      orderBy: { lastName: 'asc' },
    });

    if (students.length === 0) {
      throw new BadRequestError('This classroom has no active students to promote');
    }

    // Detect if this is Grade 12 (graduation year)
    const isGrade12 = classroom.className.trim().toLowerCase().includes('grade 12') ||
                      classroom.className.trim() === '12';

    // Compute eligibility for every student
    const eligibilityResults = await Promise.all(
      students.map((s) => computeEligibility(s.studentId, classroom.academicYear, passMarkDecimal))
    );

    // Create the batch + all entries in one transaction
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.promotionBatch.create({
        data: {
          sourceAcademicYear: classroom.academicYear,
          targetAcademicYear,
          sourceClassroomId: input.sourceClassroomId,
          preparedById: actor.userId,
        },
        include: BATCH_INCLUDE,
      });

      // Create one PromotionEntry per student
      await tx.promotionEntry.createMany({
        data: students.map((s, idx) => ({
          batchId: createdBatch.id,
          studentId: s.studentId,
          eligibilityStatus: eligibilityResults[idx].eligibilityStatus,
          // Grade 12 eligible → default GRADUATED, not PROMOTED
          // ELIGIBLE → PROMOTED
          // NOT_ELIGIBLE → REPEATED
          // PENDING_REVIEW → PROMOTED (optimistic — missing data is NOT a failure;
          //   the vice director must review and confirm before submitting)
          decision:
            isGrade12 && eligibilityResults[idx].eligibilityStatus === EligibilityStatus.ELIGIBLE
              ? PromotionDecision.GRADUATED
              : eligibilityResults[idx].eligibilityStatus === EligibilityStatus.ELIGIBLE
              ? PromotionDecision.PROMOTED
              : eligibilityResults[idx].eligibilityStatus === EligibilityStatus.NOT_ELIGIBLE
              ? PromotionDecision.REPEATED
              : PromotionDecision.PROMOTED,
          averageMark: eligibilityResults[idx].averageMark,
          attendancePercent: eligibilityResults[idx].attendancePercent,
        })),
      });

      // Re-fetch with full relations
      const full = await tx.promotionBatch.findUniqueOrThrow({
        where: { id: createdBatch.id },
        include: BATCH_INCLUDE,
      });

      return full;
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_CREATED',
      entity: 'PromotionBatch',
      entityId: String(batch.id),
      ipAddress,
      metadata: {
        sourceClassroomId: input.sourceClassroomId,
        sourceClassroomLabel: classroomLabel(classroom),
        targetAcademicYear,
        studentCount: students.length,
      },
    });

    return { batch: toBatchDetailDto(batch) };
  }

  // ── List batches ────────────────────────────────────────────────────────────

  async listBatches(
    query: ListBatchesQuery
  ): Promise<{ items: PromotionBatchSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.PromotionBatchWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.sourceClassroomId && { sourceClassroomId: query.sourceClassroomId }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.promotionBatch.findMany({
        where,
        include: BATCH_INCLUDE,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.promotionBatch.count({ where }),
    ]);

    return {
      items: items.map(toBatchSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  // ── Get batch detail ────────────────────────────────────────────────────────

  async getBatchById(id: number): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(id);
    return toBatchDetailDto(batch);
  }

  // ── Recalculate eligibility for a DRAFT batch ──────────────────────────────
  /**
   * Recomputes eligibility for every entry in a DRAFT batch.  Use after academic
   * reports have been generated so that entries created before reports existed
   * are refreshed with the correct eligibility, average mark, and attendance.
   *
   * Entries that have been manually reviewed (have an overrideReason) keep their
   * eligibility and decision — only their display data (average, attendance) is
   * refreshed.  All other entries get a full recalculation.
   */
  async recalculateBatch(
    actor: AuthenticatedUser,
    batchId: number,
    ipAddress?: string
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);
    await assertBatchEditable(batch);

    const classroom = await prisma.classroom.findUnique({
      where: { classroomId: batch.sourceClassroomId },
    });
    if (!classroom) throw new NotFoundError('Classroom');

    const settings = await prisma.systemSetting.findUnique({ where: { id: 1 } });
    const passMarkDecimal = settings ? Number(settings.promotionPassMark) : 50;

    const isGrade12 =
      classroom.className.trim().toLowerCase().includes('grade 12') ||
      classroom.className.trim() === '12';

    // Recompute eligibility for every student
    for (const entry of batch.entries) {
      const result = await computeEligibility(
        entry.studentId,
        classroom.academicYear,
        passMarkDecimal
      );

      if (entry.overrideReason) {
        // Manually reviewed — only refresh display data
        await prisma.promotionEntry.update({
          where: { id: entry.id },
          data: {
            averageMark: result.averageMark,
            attendancePercent: result.attendancePercent,
          },
        });
      } else {
        // Full recalculation — update eligibility, decision, and display data
        const newDecision =
          isGrade12 && result.eligibilityStatus === EligibilityStatus.ELIGIBLE
            ? PromotionDecision.GRADUATED
            : result.eligibilityStatus === EligibilityStatus.ELIGIBLE
            ? PromotionDecision.PROMOTED
            : result.eligibilityStatus === EligibilityStatus.NOT_ELIGIBLE
            ? PromotionDecision.REPEATED
            : PromotionDecision.PROMOTED; // PENDING_REVIEW → PROMOTED (not REPEATED)

        await prisma.promotionEntry.update({
          where: { id: entry.id },
          data: {
            eligibilityStatus: result.eligibilityStatus,
            averageMark: result.averageMark,
            attendancePercent: result.attendancePercent,
            decision: newDecision,
          },
        });
      }
    }

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_RECALCULATED',
      entity: 'PromotionBatch',
      entityId: String(batchId),
      ipAddress,
      metadata: { sourceAcademicYear: batch.sourceAcademicYear },
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Delete a DRAFT batch ───────────────────────────────────────────────────
  /**
   * Deletes a DRAFT promotion batch and all its entries.
   * Only DRAFT batches can be deleted — once submitted, the batch must be
   * rejected by the Director to undo it.
   */
  async deleteBatch(
    actor: AuthenticatedUser,
    batchId: number,
    ipAddress?: string
  ): Promise<void> {
    const batch = await assertBatchExists(batchId);
    await assertBatchEditable(batch);

    await prisma.promotionBatch.delete({ where: { id: batchId } });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_DELETED',
      entity: 'PromotionBatch',
      entityId: String(batchId),
      ipAddress,
      metadata: {
        sourceClassroomId: batch.sourceClassroomId,
        targetAcademicYear: batch.targetAcademicYear,
      },
    });
  }

  // ── Update a single entry ───────────────────────────────────────────────────

  async updateEntry(
    actor: AuthenticatedUser,
    batchId: number,
    entryId: number,
    input: UpdateEntryInput
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);
    await assertBatchEditable(batch);

    const entry = batch.entries.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundError('Promotion entry');

    // Validate target classroom belongs to target academic year
    if (input.targetClassroomId) {
      const tc = await prisma.classroom.findUnique({ where: { classroomId: input.targetClassroomId } });
      if (!tc) throw new NotFoundError('Target classroom');
      if (tc.academicYear !== batch.targetAcademicYear) {
        throw new BadRequestError(
          `Target classroom "${classroomLabel(tc)}" does not belong to the target academic year ${batch.targetAcademicYear}`
        );
      }
    }

    // GRADUATED only valid if source is Grade 12
    if (input.decision === PromotionDecision.GRADUATED) {
      const src = await prisma.classroom.findUnique({ where: { classroomId: batch.sourceClassroomId } });
      const isGrade12 = src
        ? src.className.trim().toLowerCase().includes('grade 12') || src.className.trim() === '12'
        : false;
      if (!isGrade12) {
        throw new BadRequestError('GRADUATED decision is only valid for Grade 12 students');
      }
    }

    await prisma.promotionEntry.update({
      where: { id: entryId },
      data: {
        ...(input.decision !== undefined && { decision: input.decision }),
        ...(input.targetClassroomId !== undefined && { targetClassroomId: input.targetClassroomId }),
        ...(input.overrideReason !== undefined && { overrideReason: input.overrideReason }),
        // Any manual override bumps pending to eligible (Vice Director is taking responsibility)
        ...(input.overrideReason &&
          entry.eligibilityStatus === EligibilityStatus.PENDING_REVIEW && {
            eligibilityStatus: EligibilityStatus.ELIGIBLE,
          }),
      },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_ENTRY_UPDATED',
      entity: 'PromotionEntry',
      entityId: String(entryId),
      metadata: {
        batchId,
        studentId: entry.studentId,
        previousDecision: entry.decision,
        newDecision: input.decision ?? entry.decision,
        previousTargetClassroomId: entry.targetClassroomId,
        newTargetClassroomId: input.targetClassroomId,
        overrideReason: input.overrideReason,
      },
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Bulk-assign a target classroom ─────────────────────────────────────────

  async bulkAssignClassroom(
    actor: AuthenticatedUser,
    batchId: number,
    input: BulkAssignClassroomInput
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);
    await assertBatchEditable(batch);

    const tc = await prisma.classroom.findUnique({ where: { classroomId: input.targetClassroomId } });
    if (!tc) throw new NotFoundError('Target classroom');
    if (tc.academicYear !== batch.targetAcademicYear) {
      throw new BadRequestError(
        `Target classroom "${classroomLabel(tc)}" does not belong to the target academic year ${batch.targetAcademicYear}`
      );
    }

    const decisionFilter = input.onlyDecision ?? PromotionDecision.PROMOTED;

    await prisma.promotionEntry.updateMany({
      where: { batchId, decision: decisionFilter },
      data: { targetClassroomId: input.targetClassroomId },
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Submit for Director approval ────────────────────────────────────────────

  async submitBatch(
    actor: AuthenticatedUser,
    batchId: number,
    ipAddress?: string
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);
    await assertBatchEditable(batch);

    // Guard: target year must differ from source year
    if (batch.targetAcademicYear === batch.sourceAcademicYear) {
      throw new BadRequestError(
        `Target academic year "${batch.targetAcademicYear}" is the same as the source academic year. ` +
        `Students cannot be promoted within the same academic year. ` +
        `Delete this batch and create a new one with the correct target year.`
      );
    }

    // Every PROMOTED entry must have a target classroom assigned
    const promotedWithoutTarget = batch.entries.filter(
      (e) => e.decision === PromotionDecision.PROMOTED && !e.targetClassroomId
    );
    if (promotedWithoutTarget.length > 0) {
      throw new BadRequestError(
        `${promotedWithoutTarget.length} student(s) marked PROMOTED have no target classroom assigned. Please assign classrooms before submitting.`
      );
    }

    // REPEATED students also need a target classroom (they repeat in a new section)
    const repeatedWithoutTarget = batch.entries.filter(
      (e) => e.decision === PromotionDecision.REPEATED && !e.targetClassroomId
    );
    if (repeatedWithoutTarget.length > 0) {
      throw new BadRequestError(
        `${repeatedWithoutTarget.length} student(s) marked REPEATED have no target classroom assigned.`
      );
    }

    // PENDING_REVIEW entries cannot be submitted — they require a manual decision first
    const pendingEntries = batch.entries.filter(
      (e) =>
        e.eligibilityStatus === EligibilityStatus.PENDING_REVIEW &&
        !e.overrideReason // no override = not manually reviewed
    );
    if (pendingEntries.length > 0) {
      throw new BadRequestError(
        `${pendingEntries.length} student(s) still have PENDING_REVIEW eligibility with no manual override. ` +
        `Recalculate eligibility or add an override reason for each pending student before submitting.`
      );
    }

    await prisma.promotionBatch.update({
      where: { id: batchId },
      data: { status: BatchStatus.SUBMITTED, submittedAt: new Date() },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_SUBMITTED',
      entity: 'PromotionBatch',
      entityId: String(batchId),
      ipAddress,
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Director: approve batch → executes promotion ───────────────────────────

  async approveBatch(
    actor: AuthenticatedUser,
    batchId: number,
    ipAddress?: string
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);

    if (batch.status !== BatchStatus.SUBMITTED) {
      throw new BadRequestError(`Batch must be in SUBMITTED status to approve (current: ${batch.status})`);
    }

    // Guard: target year must differ from source year — promoting within the same
    // academic year creates a unique-constraint collision on StudentEnrollment.
    if (batch.targetAcademicYear === batch.sourceAcademicYear) {
      throw new BadRequestError(
        `Target academic year "${batch.targetAcademicYear}" is the same as the source academic year. ` +
        `Students cannot be promoted within the same academic year. ` +
        `Please correct the batch target year before approving.`
      );
    }

    // Execute all promotions inside a single transaction
    await prisma.$transaction(async (tx) => {
      for (const entry of batch.entries) {
        if (entry.decision === PromotionDecision.GRADUATED) {
          // Mark student as graduated — no new classroom
          await tx.student.update({
            where: { studentId: entry.studentId },
            data: { studentStatus: 'GRADUATED' },
          });

          await tx.studentEnrollment.upsert({
            where: { studentId_academicYear: { studentId: entry.studentId, academicYear: batch.sourceAcademicYear } },
            create: {
              studentId: entry.studentId,
              classroomId: batch.sourceClassroomId,
              academicYear: batch.sourceAcademicYear,
              decision: EnrollmentDecision.GRADUATED,
              batchId: batch.id,
              notes: entry.overrideReason,
            },
            update: {
              decision: EnrollmentDecision.GRADUATED,
              batchId: batch.id,
            },
          });
        } else {
          // PROMOTED or REPEATED — move to target classroom
          const targetClassroomId = entry.targetClassroomId!;

          // Create the source-year enrollment record (history)
          const sourceEnrollment = await tx.studentEnrollment.upsert({
            where: { studentId_academicYear: { studentId: entry.studentId, academicYear: batch.sourceAcademicYear } },
            create: {
              studentId: entry.studentId,
              classroomId: batch.sourceClassroomId,
              academicYear: batch.sourceAcademicYear,
              decision:
                entry.decision === PromotionDecision.PROMOTED
                  ? EnrollmentDecision.PROMOTED
                  : EnrollmentDecision.REPEATED,
              batchId: batch.id,
              notes: entry.overrideReason,
            },
            update: {
              decision:
                entry.decision === PromotionDecision.PROMOTED
                  ? EnrollmentDecision.PROMOTED
                  : EnrollmentDecision.REPEATED,
              batchId: batch.id,
            },
          });

          // Create the target-year enrollment record (new active enrollment)
          const targetClassroom = await tx.classroom.findUniqueOrThrow({
            where: { classroomId: targetClassroomId },
          });

          await tx.studentEnrollment.create({
            data: {
              studentId: entry.studentId,
              classroomId: targetClassroomId,
              academicYear: targetClassroom.academicYear,
              decision: EnrollmentDecision.ACTIVE,
              promotedFromId: sourceEnrollment.id,
              batchId: batch.id,
            },
          });

          // Update the student's current classroom pointer
          await tx.student.update({
            where: { studentId: entry.studentId },
            data: { classroomId: targetClassroomId },
          });
        }
      }

      // Mark batch as COMPLETED
      await tx.promotionBatch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.COMPLETED,
          approvedById: actor.userId,
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      });
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_APPROVED',
      entity: 'PromotionBatch',
      entityId: String(batchId),
      ipAddress,
      metadata: {
        sourceClassroomId: batch.sourceClassroomId,
        targetAcademicYear: batch.targetAcademicYear,
        studentCount: batch.entries.length,
      },
    });

    // ── Auto-notify each student and their parents of the promotion decision ──
    for (const entry of batch.entries) {
      const student = await prisma.student.findUnique({
        where: { studentId: entry.studentId },
        select: { userId: true, firstName: true, lastName: true },
      });
      if (!student) continue;

      const decisionLabel =
        entry.decision === PromotionDecision.PROMOTED  ? 'promoted to the next grade' :
        entry.decision === PromotionDecision.GRADUATED ? 'recorded as graduated'      :
                                                          'required to repeat the year';

      const dedupBase = `promotion:batch:${batchId}:student:${entry.studentId}`;

      await createAutoNotification({
        recipientUserId:  student.userId,
        studentId:        entry.studentId,
        category:         NotificationCategory.PROMOTION,
        title:            'Promotion decision available',
        message:          `Your promotion decision for ${batch.sourceAcademicYear} has been finalized. You have been ${decisionLabel}.`,
        relatedEntity:    'PromotionBatch',
        relatedEntityId:  String(batchId),
        deduplicationKey: `${dedupBase}:student-notif`,
      });

      await notifyStudentParents({
        studentId:       entry.studentId,
        category:        NotificationCategory.PROMOTION,
        title:           `${student.firstName} ${student.lastName} — promotion decision`,
        message:         `The promotion decision for ${student.firstName} ${student.lastName} for ${batch.sourceAcademicYear} has been finalized. They have been ${decisionLabel}.`,
        relatedEntity:   'PromotionBatch',
        relatedEntityId: String(batchId),
        deduplicationKeySuffix: dedupBase,
      });
    }

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Director: reject batch ─────────────────────────────────────────────────

  async rejectBatch(
    actor: AuthenticatedUser,
    batchId: number,
    input: RejectBatchInput,
    ipAddress?: string
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);

    if (batch.status !== BatchStatus.SUBMITTED) {
      throw new BadRequestError(`Batch must be SUBMITTED to reject (current: ${batch.status})`);
    }

    await prisma.promotionBatch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.REJECTED,
        rejectedById: actor.userId,
        rejectionReason: input.rejectionReason,
      },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_BATCH_REJECTED',
      entity: 'PromotionBatch',
      entityId: String(batchId),
      ipAddress,
      metadata: { reason: input.rejectionReason },
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Correct a completed promotion entry ─────────────────────────────────────

  async correctEntry(
    actor: AuthenticatedUser,
    batchId: number,
    entryId: number,
    input: CorrectEntryInput,
    ipAddress?: string
  ): Promise<PromotionBatchDetailDto> {
    const batch = await assertBatchExists(batchId);

    if (batch.status !== BatchStatus.COMPLETED) {
      throw new BadRequestError('Corrections can only be applied to COMPLETED batches');
    }

    const entry = batch.entries.find((e) => e.id === entryId);
    if (!entry) throw new NotFoundError('Promotion entry');

    // notes is now required — validated by schema, but defend in service too
    if (!input.notes?.trim()) {
      throw new BadRequestError('A correction reason is required');
    }

    const tc = await prisma.classroom.findUnique({ where: { classroomId: input.targetClassroomId } });
    if (!tc) throw new NotFoundError('Target classroom');

    // ── Academic-activity guard ──────────────────────────────────────────────
    // Check whether the student already has any academic activity in the new
    // target classroom. Activity = grade components, or attendance.
    // If so, we block the correction so it must be reviewed by leadership
    // before proceeding.
    const [gradeActivity, attendanceActivity] = await Promise.all([
      prisma.gradeComponent.count({
        where: {
          teacherSubject: { classroomId: input.targetClassroomId },
          entries: { some: { studentId: entry.studentId } },
        },
      }),
      prisma.attendance.count({
        where: {
          studentId: entry.studentId,
          classroomId: input.targetClassroomId,
        },
      }),
    ]);

    // If the student already has grades in the target classroom, block and require
    // explicit acknowledgement. (For now we surface this as a clear error so a
    // Director/Admin can investigate before overriding manually if truly needed.)
    if (gradeActivity > 0 || attendanceActivity > 0) {
      throw new BadRequestError(
        `Student already has academic activity in the target classroom (${gradeActivity} grade record(s), ` +
        `${attendanceActivity} attendance record(s)). ` +
        `This correction requires additional authorized review before proceeding.`
      );
    }
    // Record the previous state for the audit log before making changes
    const previousClassroomId = entry.targetClassroomId;
    const previousClassroomLabel = entry.targetClassroom
      ? classroomLabel(entry.targetClassroom)
      : `classroomId:${previousClassroomId}`;

    await prisma.$transaction(async (tx) => {
      // Mark the existing target-year enrollment as CORRECTED
      await tx.studentEnrollment.updateMany({
        where: {
          studentId: entry.studentId,
          academicYear: batch.targetAcademicYear,
          decision: EnrollmentDecision.ACTIVE,
        },
        data: { decision: EnrollmentDecision.CORRECTED },
      });

      // Find the source enrollment to link from
      const sourceEnrollment = await tx.studentEnrollment.findFirst({
        where: { studentId: entry.studentId, academicYear: batch.sourceAcademicYear },
      });

      // Create a corrected enrollment
      await tx.studentEnrollment.create({
        data: {
          studentId: entry.studentId,
          classroomId: input.targetClassroomId,
          academicYear: tc.academicYear,
          decision: EnrollmentDecision.ACTIVE,
          promotedFromId: sourceEnrollment?.id ?? null,
          batchId: batch.id,
          notes: input.notes,
        },
      });

      // Update student's current classroom pointer
      await tx.student.update({
        where: { studentId: entry.studentId },
        data: { classroomId: input.targetClassroomId },
      });

      // Update the entry record
      await tx.promotionEntry.update({
        where: { id: entryId },
        data: {
          targetClassroomId: input.targetClassroomId,
          overrideReason: input.notes,
        },
      });
    });

    await recordAudit({
      userId: actor.userId,
      action: 'PROMOTION_ENTRY_CORRECTED',
      entity: 'PromotionEntry',
      entityId: String(entryId),
      ipAddress,
      metadata: {
        studentId: entry.studentId,
        studentName: `${entry.student.firstName} ${entry.student.lastName}`,
        batchId,
        // Before/after for full audit trail
        previousClassroomId,
        previousClassroomLabel,
        newClassroomId: input.targetClassroomId,
        newClassroomLabel: classroomLabel(tc),
        targetAcademicYear: batch.targetAcademicYear,
        correctionReason: input.notes,
        correctedByUserId: actor.userId,
      },
    });

    const updated = await assertBatchExists(batchId);
    return toBatchDetailDto(updated);
  }

  // ── Student enrollment history ──────────────────────────────────────────────

  async getStudentEnrollmentHistory(studentId: number): Promise<StudentEnrollmentDto[]> {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { studentId },
      include: { classroom: true },
      orderBy: { academicYear: 'asc' },
    });

    return enrollments.map((e) => ({
      id: e.id,
      studentId: e.studentId,
      classroomId: e.classroomId,
      classroomLabel: classroomLabel(e.classroom),
      academicYear: e.academicYear,
      decision: e.decision,
      batchId: e.batchId,
      notes: e.notes,
      createdAt: e.createdAt.toISOString(),
    }));
  }
}

export const promotionService = new PromotionService();
