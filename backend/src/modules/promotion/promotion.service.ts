import { BatchStatus, EligibilityStatus, EnrollmentDecision, Prisma, PromotionDecision, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { recordAudit } from '../../core/audit/audit-recorder';
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

function toEntryDto(entry: EntryWithRelations): PromotionEntryDto {
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
  };
}

function toBatchSummaryDto(batch: BatchWithRelations): PromotionBatchSummaryDto {
  const eligible = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.ELIGIBLE).length;
  const pending = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.PENDING_REVIEW).length;
  const notEligible = batch.entries.filter((e) => e.eligibilityStatus === EligibilityStatus.NOT_ELIGIBLE).length;

  return {
    id: batch.id,
    sourceAcademicYear: batch.sourceAcademicYear,
    targetAcademicYear: batch.targetAcademicYear,
    sourceClassroomId: batch.sourceClassroomId,
    sourceClassroomLabel: classroomLabel(batch.sourceClassroom),
    status: batch.status,
    preparedBy: resolveUserName(batch.preparedBy as any),
    approvedBy: batch.approvedBy ? resolveUserName(batch.approvedBy as any) : null,
    totalStudents: batch.entries.length,
    eligibleCount: eligible,
    pendingCount: pending,
    notEligibleCount: notEligible,
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
    entries: batch.entries.map(toEntryDto),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MANAGE_ROLES: RoleName[] = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

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
): Promise<{ eligibilityStatus: EligibilityStatus; averageMark: number | null; attendancePercent: number | null }> {
  // Pull both semester reports for this academic year
  const reports = await prisma.academicReport.findMany({
    where: { studentId, academicYear },
  });

  let averageMark: number | null = null;
  let eligibilityStatus: EligibilityStatus;

  if (reports.length === 0) {
    // No reports at all — results are missing
    eligibilityStatus = EligibilityStatus.PENDING_REVIEW;
  } else {
    const total = reports.reduce((sum, r) => sum + Number(r.averageMark), 0);
    averageMark = Math.round((total / reports.length) * 100) / 100;
    eligibilityStatus =
      averageMark >= passMarkDecimal
        ? EligibilityStatus.ELIGIBLE
        : EligibilityStatus.NOT_ELIGIBLE;
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

  return { eligibilityStatus, averageMark, attendancePercent };
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

    // Prevent duplicate DRAFT / SUBMITTED batches for the same source classroom → target year
    const existing = await prisma.promotionBatch.findFirst({
      where: {
        sourceClassroomId: input.sourceClassroomId,
        targetAcademicYear: input.targetAcademicYear,
        status: { in: [BatchStatus.DRAFT, BatchStatus.SUBMITTED, BatchStatus.APPROVED] },
      },
    });
    if (existing) {
      throw new ConflictError(
        `A promotion batch for this classroom to ${input.targetAcademicYear} already exists (status: ${existing.status})`
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
          targetAcademicYear: input.targetAcademicYear,
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
          decision:
            isGrade12 && eligibilityResults[idx].eligibilityStatus === EligibilityStatus.ELIGIBLE
              ? PromotionDecision.GRADUATED
              : eligibilityResults[idx].eligibilityStatus === EligibilityStatus.ELIGIBLE
              ? PromotionDecision.PROMOTED
              : PromotionDecision.REPEATED,
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
        targetAcademicYear: input.targetAcademicYear,
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

    const tc = await prisma.classroom.findUnique({ where: { classroomId: input.targetClassroomId } });
    if (!tc) throw new NotFoundError('Target classroom');

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
          notes: input.notes ?? `Correction by userId:${actor.userId}`,
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
          overrideReason: input.notes ?? entry.overrideReason,
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
        batchId,
        newClassroomId: input.targetClassroomId,
        notes: input.notes,
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
