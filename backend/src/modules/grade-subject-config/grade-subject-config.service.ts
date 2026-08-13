import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { recordAudit } from '../../core/audit/audit-recorder';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CopyFromYearInput,
  GradeSubjectConfigDto,
  ListGradeSubjectConfigQuery,
  UpsertGradeSubjectConfigInput,
} from './dto/grade-subject-config.dto';

const MANAGE_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

function toDto(
  row: Prisma.GradeSubjectConfigGetPayload<{ include: { subject: true } }>
): GradeSubjectConfigDto {
  return {
    id: row.id,
    className: row.className,
    academicYear: row.academicYear,
    subjectId: row.subjectId,
    subjectCode: row.subject.subjectCode,
    subjectName: row.subject.subjectName,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export class GradeSubjectConfigService {
  /**
   * Returns all configured subjects for a grade in an academic year,
   * ordered by sortOrder then subject name.
   */
  async listForGrade(query: ListGradeSubjectConfigQuery): Promise<GradeSubjectConfigDto[]> {
    const rows = await prisma.gradeSubjectConfig.findMany({
      where: { className: query.className, academicYear: query.academicYear },
      include: { subject: true },
      orderBy: [{ sortOrder: 'asc' }, { subject: { subjectName: 'asc' } }],
    });
    return rows.map(toDto);
  }

  /**
   * Returns all distinct (className, academicYear) combinations that have
   * been configured — useful for the management UI to list what exists.
   */
  async listConfiguredGrades(): Promise<{ className: string; academicYear: string; subjectCount: number }[]> {
    const rows = await prisma.gradeSubjectConfig.groupBy({
      by: ['className', 'academicYear'],
      _count: { id: true },
      orderBy: [{ academicYear: 'desc' }, { className: 'asc' }],
    });
    return rows.map((r) => ({
      className: r.className,
      academicYear: r.academicYear,
      subjectCount: r._count.id,
    }));
  }

  /**
   * Adds a subject to a grade's configuration for an academic year.
   * Idempotent — if the entry already exists, updates sortOrder only.
   */
  async upsert(
    actor: AuthenticatedUser,
    input: UpsertGradeSubjectConfigInput,
    ipAddress?: string
  ): Promise<GradeSubjectConfigDto> {
    if (!MANAGE_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Directors, Vice Directors and Administrators can manage grade subject configuration');
    }

    const subject = await prisma.subject.findUnique({ where: { subjectId: input.subjectId } });
    if (!subject) throw new NotFoundError('Subject');

    const row = await prisma.gradeSubjectConfig.upsert({
      where: {
        className_academicYear_subjectId: {
          className: input.className,
          academicYear: input.academicYear,
          subjectId: input.subjectId,
        },
      },
      create: {
        className: input.className,
        academicYear: input.academicYear,
        subjectId: input.subjectId,
        sortOrder: input.sortOrder ?? 0,
      },
      update: {
        sortOrder: input.sortOrder ?? 0,
        updatedAt: new Date(),
      },
      include: { subject: true },
    });

    await recordAudit({
      userId: actor.userId,
      action: 'GRADE_SUBJECT_CONFIG_UPSERTED',
      entity: 'GradeSubjectConfig',
      entityId: String(row.id),
      ipAddress,
      metadata: { className: input.className, academicYear: input.academicYear, subjectId: input.subjectId },
    });

    return toDto(row);
  }

  /**
   * Removes a subject from a grade's configuration.
   */
  async remove(actor: AuthenticatedUser, id: number, ipAddress?: string): Promise<void> {
    if (!MANAGE_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Directors, Vice Directors and Administrators can manage grade subject configuration');
    }

    const row = await prisma.gradeSubjectConfig.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('Grade subject configuration entry');

    await prisma.gradeSubjectConfig.delete({ where: { id } });

    await recordAudit({
      userId: actor.userId,
      action: 'GRADE_SUBJECT_CONFIG_REMOVED',
      entity: 'GradeSubjectConfig',
      entityId: String(id),
      ipAddress,
      metadata: { className: row.className, academicYear: row.academicYear, subjectId: row.subjectId },
    });
  }

  /**
   * Copies all subject configurations from one academic year to another
   * for a given grade. Only copies entries that do not already exist in
   * the target year. Returns the count of newly created entries.
   */
  async copyFromYear(
    actor: AuthenticatedUser,
    input: CopyFromYearInput,
    ipAddress?: string
  ): Promise<{ created: number; skipped: number }> {
    if (!MANAGE_ROLES.includes(actor.role)) {
      throw new ForbiddenError('Only Directors, Vice Directors and Administrators can manage grade subject configuration');
    }

    const sourceRows = await prisma.gradeSubjectConfig.findMany({
      where: { className: input.className, academicYear: input.sourceAcademicYear },
      orderBy: { sortOrder: 'asc' },
    });

    if (sourceRows.length === 0) {
      throw new NotFoundError(
        `No subject configuration found for ${input.className} in ${input.sourceAcademicYear}`
      );
    }

    const existingInTarget = await prisma.gradeSubjectConfig.findMany({
      where: { className: input.className, academicYear: input.targetAcademicYear },
    });
    const existingSubjectIds = new Set(existingInTarget.map((r) => r.subjectId));

    const toCreate = sourceRows.filter((r) => !existingSubjectIds.has(r.subjectId));

    if (toCreate.length > 0) {
      await prisma.gradeSubjectConfig.createMany({
        data: toCreate.map((r) => ({
          className: input.className,
          academicYear: input.targetAcademicYear,
          subjectId: r.subjectId,
          sortOrder: r.sortOrder,
        })),
      });
    }

    await recordAudit({
      userId: actor.userId,
      action: 'GRADE_SUBJECT_CONFIG_COPIED',
      entity: 'GradeSubjectConfig',
      entityId: `${input.className}|${input.targetAcademicYear}`,
      ipAddress,
      metadata: {
        className: input.className,
        sourceAcademicYear: input.sourceAcademicYear,
        targetAcademicYear: input.targetAcademicYear,
        created: toCreate.length,
        skipped: existingInTarget.length,
      },
    });

    return { created: toCreate.length, skipped: existingInTarget.length };
  }
}

export const gradeSubjectConfigService = new GradeSubjectConfigService();
