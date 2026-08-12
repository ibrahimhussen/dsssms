import { FinalizationStatus, Prisma, RoleName, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/app-error';
import { recordAudit } from '../../core/audit/audit-recorder';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CorrectFinalizationInput,
  FinalizeClassroomInput,
  FinalizeSubjectInput,
  ReviewSubjectInput,
  SubmitForReviewInput,
} from './dto/finalization.dto';
import {
  ClassroomFinalizationDto,
  SubjectFinalizationDto,
  SubjectFinalizationSummaryDto,
} from './dto/finalization.dto';

const FINALIZATION_ROLES: RoleName[] = [RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN];

// ── Prisma include shapes ─────────────────────────────────────────────────────

const SUBJECT_FINALIZATION_INCLUDE = {
  teacherSubject: {
    include: {
      subject: true,
      teacher: true,
      classroom: true,
    },
  },
  reviewedByUser: {
    include: {
      director: true,
      viceDirector: true,
      administrator: true,
    },
  },
  finalizedByUser: {
    include: {
      director: true,
      viceDirector: true,
      administrator: true,
    },
  },
} satisfies Prisma.SubjectFinalizationInclude;

const CLASSROOM_FINALIZATION_INCLUDE = {
  classroom: true,
  finalizedByUser: {
    include: {
      director: true,
      viceDirector: true,
      administrator: true,
    },
  },
} satisfies Prisma.ClassroomFinalizationInclude;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toSubjectFinalizationDto(
  finalization: Prisma.SubjectFinalizationGetPayload<{ include: typeof SUBJECT_FINALIZATION_INCLUDE }>
): SubjectFinalizationDto {
  const getUserInfo = (user: typeof finalization.reviewedByUser) => {
    if (!user) return undefined;
    if (user.director) return { userId: user.userId, firstName: user.director.firstName, lastName: user.director.lastName };
    if (user.viceDirector) return { userId: user.userId, firstName: user.viceDirector.firstName, lastName: user.viceDirector.lastName };
    if (user.administrator) return { userId: user.userId, firstName: user.administrator.firstName, lastName: user.administrator.lastName };
    return { userId: user.userId, firstName: 'Unknown', lastName: 'User' };
  };

  return {
    id: finalization.id,
    teacherSubjectId: finalization.teacherSubjectId,
    semester: finalization.semester,
    academicYear: finalization.academicYear,
    status: finalization.status,
    reviewedBy: finalization.reviewedBy,
    reviewedAt: finalization.reviewedAt?.toISOString() ?? null,
    reviewedByUser: getUserInfo(finalization.reviewedByUser),
    finalizedBy: finalization.finalizedBy,
    finalizedAt: finalization.finalizedAt?.toISOString() ?? null,
    finalizedByUser: getUserInfo(finalization.finalizedByUser),
    correctionReason: finalization.correctionReason,
    lastCorrectionAt: finalization.lastCorrectionAt?.toISOString() ?? null,
    createdAt: finalization.createdAt.toISOString(),
    updatedAt: finalization.updatedAt.toISOString(),
    studentCount: 0, // Calculated separately in getClassroomSubjectFinalizations
    missingResultsCount: 0, // Calculated separately in getClassroomSubjectFinalizations
  };
}

function toClassroomFinalizationDto(
  finalization: Prisma.ClassroomFinalizationGetPayload<{ include: typeof CLASSROOM_FINALIZATION_INCLUDE }>
): ClassroomFinalizationDto {
  return {
    id: finalization.id,
    classroomId: finalization.classroomId,
    semester: finalization.semester,
    academicYear: finalization.academicYear,
    status: finalization.status,
    finalizedBy: finalization.finalizedBy,
    finalizedAt: finalization.finalizedAt?.toISOString() ?? null,
    correctionReason: finalization.correctionReason,
    lastCorrectionAt: finalization.lastCorrectionAt?.toISOString() ?? null,
    createdAt: finalization.createdAt.toISOString(),
    updatedAt: finalization.updatedAt.toISOString(),
  };
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertTeacherOwnsTeacherSubject(userId: number, teacherSubjectId: number) {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile found for this account');

  const teacherSubject = await prisma.teacherSubject.findUnique({
    where: { id: teacherSubjectId },
  });
  if (!teacherSubject) throw new NotFoundError('Teaching assignment');

  if (teacherSubject.teacherId !== teacher.teacherId) {
    throw new ForbiddenError('You may only manage finalization for subjects you teach');
  }
  return teacherSubject;
}

async function assertCanAccessClassroom(actor: AuthenticatedUser, classroomId: number) {
  if (!FINALIZATION_ROLES.includes(actor.role)) {
    throw new ForbiddenError('You do not have permission to access classroom finalization');
  }

  const classroom = await prisma.classroom.findUnique({
    where: { classroomId },
  });
  if (!classroom) throw new NotFoundError('Classroom');

  // TODO: Implement Vice Director oversight area restrictions here
  // For now, all VICE_DIRECTOR, DIRECTOR, and ADMIN have full access
  return classroom;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class FinalizationService {
  /**
   * Stage 1: Teacher submits subject results for Vice Director review.
   * Changes status from DRAFT to UNDER_REVIEW.
   */
  async submitForReview(
    actor: AuthenticatedUser,
    input: SubmitForReviewInput,
    ipAddress?: string
  ): Promise<SubjectFinalizationDto> {
    if (actor.role !== RoleName.TEACHER) {
      throw new ForbiddenError('Only teachers can submit results for review');
    }

    await assertTeacherOwnsTeacherSubject(actor.userId, input.teacherSubjectId);

    const finalization = await prisma.subjectFinalization.upsert({
      where: {
        teacherSubjectId_semester_academicYear: {
          teacherSubjectId: input.teacherSubjectId,
          semester: input.semester,
          academicYear: input.academicYear,
        },
      },
      create: {
        teacherSubjectId: input.teacherSubjectId,
        semester: input.semester,
        academicYear: input.academicYear,
        status: FinalizationStatus.UNDER_REVIEW,
      },
      update: {
        status: FinalizationStatus.UNDER_REVIEW,
        updatedAt: new Date(),
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'SUBJECT_SUBMITTED_FOR_REVIEW',
      entity: 'SubjectFinalization',
      entityId: String(finalization.id),
      ipAddress,
      metadata: {
        teacherSubjectId: input.teacherSubjectId,
        semester: input.semester,
        academicYear: input.academicYear,
      },
    });

    return toSubjectFinalizationDto(finalization);
  }

  /**
   * Stage 1: Vice Director reviews subject results.
   * If approved: status changes to APPROVED.
   * If rejected: status changes back to DRAFT with review notes.
   */
  async reviewSubject(
    actor: AuthenticatedUser,
    input: ReviewSubjectInput,
    ipAddress?: string
  ): Promise<SubjectFinalizationDto> {
    if (!FINALIZATION_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only authorized staff can review subject results');
    }

    const finalization = await prisma.subjectFinalization.findUnique({
      where: {
        teacherSubjectId_semester_academicYear: {
          teacherSubjectId: input.teacherSubjectId,
          semester: input.semester,
          academicYear: input.academicYear,
        },
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Subject finalization record not found');
    }

    if (finalization.status !== FinalizationStatus.UNDER_REVIEW) {
      throw new BadRequestError(
        `Can only review subjects in UNDER_REVIEW status (current: ${finalization.status})`
      );
    }

    const newStatus = input.approved ? FinalizationStatus.APPROVED : FinalizationStatus.DRAFT;

    const updated = await prisma.subjectFinalization.update({
      where: { id: finalization.id },
      data: {
        status: newStatus,
        reviewedBy: input.approved ? actor.userId : null,
        reviewedAt: input.approved ? new Date() : null,
        updatedAt: new Date(),
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: input.approved ? 'SUBJECT_APPROVED' : 'SUBJECT_REJECTED',
      entity: 'SubjectFinalization',
      entityId: String(finalization.id),
      ipAddress,
      metadata: {
        teacherSubjectId: input.teacherSubjectId,
        semester: input.semester,
        academicYear: input.academicYear,
        reviewNotes: input.reviewNotes,
      },
    });

    return toSubjectFinalizationDto(updated);
  }

  /**
   * Stage 1: Vice Director or Director finalizes subject results.
   * Changes status from APPROVED to FINALIZED.
   */
  async finalizeSubject(
    actor: AuthenticatedUser,
    input: FinalizeSubjectInput,
    ipAddress?: string
  ): Promise<SubjectFinalizationDto> {
    if (!FINALIZATION_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only authorized staff can finalize subject results');
    }

    const finalization = await prisma.subjectFinalization.findUnique({
      where: {
        teacherSubjectId_semester_academicYear: {
          teacherSubjectId: input.teacherSubjectId,
          semester: input.semester,
          academicYear: input.academicYear,
        },
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Subject finalization record not found');
    }

    if (finalization.status !== FinalizationStatus.APPROVED) {
      throw new BadRequestError(
        `Can only finalize subjects in APPROVED status (current: ${finalization.status})`
      );
    }

    const updated = await prisma.subjectFinalization.update({
      where: { id: finalization.id },
      data: {
        status: FinalizationStatus.FINALIZED,
        finalizedBy: actor.userId,
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'SUBJECT_FINALIZED',
      entity: 'SubjectFinalization',
      entityId: String(finalization.id),
      ipAddress,
      metadata: {
        teacherSubjectId: input.teacherSubjectId,
        semester: input.semester,
        academicYear: input.academicYear,
      },
    });

    return toSubjectFinalizationDto(updated);
  }

  /**
   * Stage 2: Vice Director or Director finalizes entire classroom.
   * All subjects must be FINALIZED before classroom can be finalized.
   */
  async finalizeClassroom(
    actor: AuthenticatedUser,
    input: FinalizeClassroomInput,
    ipAddress?: string
  ): Promise<ClassroomFinalizationDto> {
    await assertCanAccessClassroom(actor, input.classroomId);

    // Check that all subjects for this classroom are finalized
    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classroomId: input.classroomId },
    });

    const subjectFinalizations = await prisma.subjectFinalization.findMany({
      where: {
        teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
        semester: input.semester,
        academicYear: input.academicYear,
      },
    });

    const notFinalized = subjectFinalizations.filter(
      (sf) => sf.status !== FinalizationStatus.FINALIZED
    );

    if (notFinalized.length > 0) {
      throw new BadRequestError(
        `${notFinalized.length} subject(s) are not yet finalized. All subjects must be finalized before the classroom can be finalized.`
      );
    }

    const finalization = await prisma.classroomFinalization.upsert({
      where: {
        classroomId_semester_academicYear: {
          classroomId: input.classroomId,
          semester: input.semester,
          academicYear: input.academicYear,
        },
      },
      create: {
        classroomId: input.classroomId,
        semester: input.semester,
        academicYear: input.academicYear,
        status: FinalizationStatus.FINALIZED,
        finalizedBy: actor.userId,
        finalizedAt: new Date(),
      },
      update: {
        status: FinalizationStatus.FINALIZED,
        finalizedBy: actor.userId,
        finalizedAt: new Date(),
        updatedAt: new Date(),
      },
      include: CLASSROOM_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'CLASSROOM_FINALIZED',
      entity: 'ClassroomFinalization',
      entityId: String(finalization.id),
      ipAddress,
      metadata: {
        classroomId: input.classroomId,
        semester: input.semester,
        academicYear: input.academicYear,
      },
    });

    return toClassroomFinalizationDto(finalization);
  }

  /**
   * Get subject finalization details.
   */
  async getSubjectFinalization(
    actor: AuthenticatedUser,
    teacherSubjectId: number,
    semester: Semester,
    academicYear: string
  ): Promise<SubjectFinalizationDto> {
    const finalization = await prisma.subjectFinalization.findUnique({
      where: {
        teacherSubjectId_semester_academicYear: {
          teacherSubjectId,
          semester,
          academicYear,
        },
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Subject finalization not found');
    }

    // Teachers can only view their own subjects
    if (actor.role === RoleName.TEACHER) {
      await assertTeacherOwnsTeacherSubject(actor.userId, teacherSubjectId);
    }

    return toSubjectFinalizationDto(finalization);
  }

  /**
   * Get classroom finalization details.
   */
  async getClassroomFinalization(
    actor: AuthenticatedUser,
    classroomId: number,
    semester: Semester,
    academicYear: string
  ): Promise<ClassroomFinalizationDto> {
    await assertCanAccessClassroom(actor, classroomId);

    const finalization = await prisma.classroomFinalization.findUnique({
      where: {
        classroomId_semester_academicYear: {
          classroomId,
          semester,
          academicYear,
        },
      },
      include: CLASSROOM_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Classroom finalization not found');
    }

    return toClassroomFinalizationDto(finalization);
  }

  /**
   * Get all subject finalizations for a classroom.
   */
  async getClassroomSubjectFinalizations(
    actor: AuthenticatedUser,
    classroomId: number,
    semester: Semester,
    academicYear: string
  ): Promise<SubjectFinalizationDto[]> {
    await assertCanAccessClassroom(actor, classroomId);

    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classroomId },
      include: {
        subject: true,
        teacher: true,
        classroom: true,
      },
    });

    const finalizations = await prisma.subjectFinalization.findMany({
      where: {
        teacherSubjectId: { in: teacherSubjects.map((ts) => ts.id) },
        semester,
        academicYear,
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    const finalizationMap = new Map(
      finalizations.map((f) => [f.teacherSubjectId, f])
    );

    const result: SubjectFinalizationDto[] = [];

    for (const ts of teacherSubjects) {
      const finalization = finalizationMap.get(ts.id);

      // Get student count and completion status
      const students = await prisma.student.findMany({
        where: { classroomId },
      });

      const gradeComponents = await prisma.gradeComponent.findMany({
        where: {
          teacherSubjectId: ts.id,
          semester,
          academicYear,
        },
        include: {
          entries: true,
        },
      });

      const totalComponents = gradeComponents.length;
      let completedStudentCount = 0;

      for (const student of students) {
        let studentComplete = true;
        for (const component of gradeComponents) {
          const entry = component.entries.find((e) => e.studentId === student.studentId);
          if (!entry) {
            studentComplete = false;
            break;
          }
        }
        if (studentComplete) completedStudentCount++;
      }

      const baseDto = finalization ? toSubjectFinalizationDto(finalization) : {
        id: 0,
        teacherSubjectId: ts.id,
        semester,
        academicYear,
        status: 'DRAFT' as FinalizationStatus,
        reviewedBy: null,
        reviewedAt: null,
        finalizedBy: null,
        finalizedAt: null,
        correctionReason: null,
        lastCorrectionAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studentCount: students.length,
        missingResultsCount: students.length - completedStudentCount,
      };

      result.push({
        ...baseDto,
        studentCount: students.length,
        missingResultsCount: students.length - completedStudentCount,
      });
    }

    return result;
  }

  /**
   * Post-finalization correction with audit logging.
   */
  async correctSubjectFinalization(
    actor: AuthenticatedUser,
    id: number,
    input: CorrectFinalizationInput,
    ipAddress?: string
  ): Promise<SubjectFinalizationDto> {
    if (!FINALIZATION_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only authorized staff can correct finalized results');
    }

    const finalization = await prisma.subjectFinalization.findUnique({
      where: { id },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Subject finalization not found');
    }

    if (finalization.status !== FinalizationStatus.FINALIZED) {
      throw new BadRequestError('Can only correct finalized results');
    }

    const updated = await prisma.subjectFinalization.update({
      where: { id },
      data: {
        status: FinalizationStatus.UNDER_REVIEW,
        correctionReason: input.correctionReason,
        lastCorrectionAt: new Date(),
        updatedAt: new Date(),
      },
      include: SUBJECT_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'SUBJECT_FINALIZATION_CORRECTED',
      entity: 'SubjectFinalization',
      entityId: String(id),
      ipAddress,
      metadata: {
        correctionReason: input.correctionReason,
        previousStatus: finalization.status,
      },
    });

    return toSubjectFinalizationDto(updated);
  }

  /**
   * Post-finalization correction for classroom with audit logging.
   */
  async correctClassroomFinalization(
    actor: AuthenticatedUser,
    id: number,
    input: CorrectFinalizationInput,
    ipAddress?: string
  ): Promise<ClassroomFinalizationDto> {
    if (!FINALIZATION_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only authorized staff can correct finalized results');
    }

    const finalization = await prisma.classroomFinalization.findUnique({
      where: { id },
      include: CLASSROOM_FINALIZATION_INCLUDE,
    });

    if (!finalization) {
      throw new NotFoundError('Classroom finalization not found');
    }

    if (finalization.status !== FinalizationStatus.FINALIZED) {
      throw new BadRequestError('Can only correct finalized results');
    }

    const updated = await prisma.classroomFinalization.update({
      where: { id },
      data: {
        status: FinalizationStatus.UNDER_REVIEW,
        correctionReason: input.correctionReason,
        lastCorrectionAt: new Date(),
        updatedAt: new Date(),
      },
      include: CLASSROOM_FINALIZATION_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'CLASSROOM_FINALIZATION_CORRECTED',
      entity: 'ClassroomFinalization',
      entityId: String(id),
      ipAddress,
      metadata: {
        correctionReason: input.correctionReason,
        previousStatus: finalization.status,
      },
    });

    return toClassroomFinalizationDto(updated);
  }
}

export const finalizationService = new FinalizationService();