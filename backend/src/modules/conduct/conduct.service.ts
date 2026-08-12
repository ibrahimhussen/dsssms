import { ConductRating, Prisma, RoleName, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../core/errors/app-error';
import { recordAudit } from '../../core/audit/audit-recorder';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  ClassroomConductSummaryDto,
  CreateConductInput,
  StudentConductDetailDto,
  StudentConductDto,
  UpdateConductInput,
} from './dto/conduct.dto';

const CONDUCT_ROLES: RoleName[] = [RoleName.VICE_DIRECTOR, RoleName.DIRECTOR];
// Admin does not have conduct authority (technical role only)

// ── Prisma include shapes ─────────────────────────────────────────────────────

const CONDUCT_INCLUDE = {
  student: true,
  classroom: true,
  assignedByUser: {
    include: {
      director: true,
      viceDirector: true,
      administrator: true,
    },
  },
} satisfies Prisma.StudentConductInclude;

// ── Mappers ───────────────────────────────────────────────────────────────────

function toConductDto(
  conduct: Prisma.StudentConductGetPayload<{ include: typeof CONDUCT_INCLUDE }>
): StudentConductDto {
  return {
    id: conduct.id,
    studentId: conduct.studentId,
    classroomId: conduct.classroomId,
    academicYear: conduct.academicYear,
    semester: conduct.semester,
    rating: conduct.rating,
    assignedBy: conduct.assignedBy,
    assignedAt: conduct.assignedAt.toISOString(),
    notes: conduct.notes,
    updatedAt: conduct.updatedAt.toISOString(),
  };
}

function toConductDetailDto(
  conduct: Prisma.StudentConductGetPayload<{ include: typeof CONDUCT_INCLUDE }>
): StudentConductDetailDto {
  const assignedByName = resolveUserName(conduct.assignedByUser);
  return {
    ...toConductDto(conduct),
    studentName: `${conduct.student.firstName} ${conduct.student.lastName}`,
    admissionNumber: conduct.student.admissionNumber,
    classroomLabel: `${conduct.classroom.className} ${conduct.classroom.section}`,
    assignedByName,
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

async function assertCanAccessClassroom(actor: AuthenticatedUser, classroomId: number) {
  if (!CONDUCT_ROLES.includes(actor.role)) {
    throw new ForbiddenError('Only Vice Directors and Directors can manage conduct');
  }

  const classroom = await prisma.classroom.findUnique({
    where: { classroomId },
  });
  if (!classroom) throw new NotFoundError('Classroom');

  // TODO: Implement Vice Director oversight area restrictions here
  // For now, all VICE_DIRECTOR and DIRECTOR have full access
  return classroom;
}

async function assertStudentInClassroom(studentId: number, classroomId: number) {
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: { classroom: true },
  });

  if (!student) throw new NotFoundError('Student');
  if (student.classroomId !== classroomId) {
    throw new BadRequestError('Student is not enrolled in this classroom');
  }

  return student;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ConductService {
  /**
   * Create or update conduct rating for a student.
   */
  async upsertConduct(
    actor: AuthenticatedUser,
    input: CreateConductInput,
    ipAddress?: string
  ): Promise<StudentConductDetailDto> {
    if (!CONDUCT_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Vice Directors and Directors can assign conduct ratings');
    }

    await assertCanAccessClassroom(actor, input.classroomId);
    await assertStudentInClassroom(input.studentId, input.classroomId);

    const conduct = await prisma.studentConduct.upsert({
      where: {
        studentId_classroomId_academicYear_semester: {
          studentId: input.studentId,
          classroomId: input.classroomId,
          academicYear: input.academicYear,
          semester: input.semester,
        },
      },
      create: {
        studentId: input.studentId,
        classroomId: input.classroomId,
        academicYear: input.academicYear,
        semester: input.semester,
        rating: input.rating,
        assignedBy: actor.userId,
        notes: input.notes,
      },
      update: {
        rating: input.rating,
        notes: input.notes,
        updatedAt: new Date(),
      },
      include: CONDUCT_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'CONDUCT_ASSIGNED',
      entity: 'StudentConduct',
      entityId: String(conduct.id),
      ipAddress,
      metadata: {
        studentId: input.studentId,
        classroomId: input.classroomId,
        rating: input.rating,
        academicYear: input.academicYear,
        semester: input.semester,
      },
    });

    return toConductDetailDto(conduct);
  }

  /**
   * Update existing conduct rating.
   */
  async updateConduct(
    actor: AuthenticatedUser,
    id: number,
    input: UpdateConductInput,
    ipAddress?: string
  ): Promise<StudentConductDetailDto> {
    if (!CONDUCT_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Vice Directors and Directors can update conduct ratings');
    }

    const existing = await prisma.studentConduct.findUnique({
      where: { id },
      include: CONDUCT_INCLUDE,
    });

    if (!existing) throw new NotFoundError('Conduct record not found');

    await assertCanAccessClassroom(actor, existing.classroomId);

    const updated = await prisma.studentConduct.update({
      where: { id },
      data: {
        ...(input.rating && { rating: input.rating }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updatedAt: new Date(),
      },
      include: CONDUCT_INCLUDE,
    });

    await recordAudit({
      userId: actor.userId,
      action: 'CONDUCT_UPDATED',
      entity: 'StudentConduct',
      entityId: String(id),
      ipAddress,
      metadata: {
        previousRating: existing.rating,
        newRating: input.rating,
        notes: input.notes,
      },
    });

    return toConductDetailDto(updated);
  }

  /**
   * Get conduct record for a specific student.
   */
  async getStudentConduct(
    actor: AuthenticatedUser,
    studentId: number,
    classroomId: number,
    semester: Semester,
    academicYear: string
  ): Promise<StudentConductDetailDto> {
    const conduct = await prisma.studentConduct.findUnique({
      where: {
        studentId_classroomId_academicYear_semester: {
          studentId,
          classroomId,
          academicYear,
          semester,
        },
      },
      include: CONDUCT_INCLUDE,
    });

    if (!conduct) {
      throw new NotFoundError('Conduct record not found for this student/period');
    }

    // Students can only view their own conduct
    if (actor.role === RoleName.STUDENT) {
      if (actor.userId !== conduct.student.userId) {
        throw new ForbiddenError('You can only view your own conduct records');
      }
    }

    // Parents can only view their children's conduct
    if (actor.role === RoleName.PARENT) {
      const parentLinks = await prisma.studentParentLink.findMany({
        where: {
          parentId: actor.userId,
          studentId,
        },
      });

      if (parentLinks.length === 0) {
        throw new ForbiddenError('You can only view conduct records for your linked children');
      }
    }

    return toConductDetailDto(conduct);
  }

  /**
   * Get all conduct records for a classroom.
   */
  async getClassroomConducts(
    actor: AuthenticatedUser,
    classroomId: number,
    semester: Semester,
    academicYear: string
  ): Promise<StudentConductDetailDto[]> {
    await assertCanAccessClassroom(actor, classroomId);

    const conducts = await prisma.studentConduct.findMany({
      where: {
        classroomId,
        semester,
        academicYear,
      },
      include: CONDUCT_INCLUDE,
      orderBy: { student: { lastName: 'asc' } },
    });

    return conducts.map(toConductDetailDto);
  }

  /**
   * Get conduct summary for a classroom.
   */
  async getClassroomConductSummary(
    actor: AuthenticatedUser,
    classroomId: number,
    semester: Semester,
    academicYear: string
  ): Promise<ClassroomConductSummaryDto> {
    await assertCanAccessClassroom(actor, classroomId);

    const classroom = await prisma.classroom.findUnique({
      where: { classroomId },
    });

    if (!classroom) throw new NotFoundError('Classroom');

    const [totalStudents, conducts] = await Promise.all([
      prisma.student.count({ where: { classroomId } }),
      prisma.studentConduct.findMany({
        where: {
          classroomId,
          semester,
          academicYear,
        },
      }),
    ]);

    const ratingDistribution = {
      EXCELLENT: 0,
      VERY_GOOD: 0,
      GOOD: 0,
      SATISFACTORY: 0,
      NEEDS_IMPROVEMENT: 0,
    };

    for (const conduct of conducts) {
      ratingDistribution[conduct.rating]++;
    }

    return {
      classroomId,
      classroomLabel: `${classroom.className} ${classroom.section}`,
      academicYear,
      semester,
      totalStudents,
      ratedStudents: conducts.length,
      ratingDistribution,
    };
  }

  /**
   * Delete conduct record (typically for corrections).
   */
  async deleteConduct(
    actor: AuthenticatedUser,
    id: number,
    ipAddress?: string
  ): Promise<void> {
    if (!CONDUCT_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Vice Directors and Directors can delete conduct records');
    }

    const existing = await prisma.studentConduct.findUnique({
      where: { id },
      include: { classroom: true },
    });

    if (!existing) throw new NotFoundError('Conduct record not found');

    await assertCanAccessClassroom(actor, existing.classroomId);

    await prisma.studentConduct.delete({
      where: { id },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'CONDUCT_DELETED',
      entity: 'StudentConduct',
      entityId: String(id),
      ipAddress,
      metadata: {
        studentId: existing.studentId,
        classroomId: existing.classroomId,
        previousRating: existing.rating,
      },
    });
  }
}

export const conductService = new ConductService();