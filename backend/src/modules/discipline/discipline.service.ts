import { DisciplineSeverity, DisciplineStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { NotFoundError } from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CreateDisciplineRecordInput,
  DisciplineRecordDto,
  UpdateDisciplineRecordInput,
} from './discipline.dto';

// Re-export Prisma enums so the controller / DTO file can reference them
export { DisciplineSeverity, DisciplineStatus };

const RECORD_INCLUDE = {
  student: {
    include: { classroom: true },
  },
  reportedBy: {
    select: { username: true },
  },
} satisfies Prisma.DisciplineRecordInclude;

type RecordWithRelations = Prisma.DisciplineRecordGetPayload<{
  include: typeof RECORD_INCLUDE;
}>;

function toDto(r: RecordWithRelations): DisciplineRecordDto {
  return {
    id:              r.id,
    studentId:       r.studentId,
    studentName:     `${r.student.firstName} ${r.student.lastName}`,
    admissionNumber: r.student.admissionNumber,
    className:       `${r.student.classroom.className} ${r.student.classroom.section}`,
    incidentDate:    r.incidentDate,
    title:           r.title,
    description:     r.description,
    severity:        r.severity as DisciplineSeverity,
    status:          r.status as DisciplineStatus,
    reportedBy:      r.reportedBy.username,
    actionTaken:     r.actionTaken ?? undefined,
    createdAt:       r.createdAt.toISOString(),
  };
}

export class DisciplineService {
  async listRecords(filters?: {
    studentId?: number;
    severity?: DisciplineSeverity;
    status?: DisciplineStatus;
    search?: string;
  }): Promise<DisciplineRecordDto[]> {
    const where: Prisma.DisciplineRecordWhereInput = {
      ...(filters?.studentId && { studentId: filters.studentId }),
      ...(filters?.severity  && { severity: filters.severity }),
      ...(filters?.status    && { status: filters.status }),
      ...(filters?.search && {
        OR: [
          { title:       { contains: filters.search } },
          { description: { contains: filters.search } },
          { student: {
            OR: [
              { firstName:       { contains: filters.search } },
              { lastName:        { contains: filters.search } },
              { admissionNumber: { contains: filters.search } },
            ],
          }},
        ],
      }),
    };

    const records = await prisma.disciplineRecord.findMany({
      where,
      include: RECORD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return records.map(toDto);
  }

  async createRecord(
    actor: AuthenticatedUser,
    input: CreateDisciplineRecordInput
  ): Promise<DisciplineRecordDto> {
    // Verify the student exists
    const student = await prisma.student.findUnique({
      where: { studentId: input.studentId },
    });
    if (!student) throw new NotFoundError('Student');

    const record = await prisma.disciplineRecord.create({
      data: {
        studentId:        input.studentId,
        incidentDate:     input.incidentDate ?? new Date().toISOString().slice(0, 10),
        title:            input.title,
        description:      input.description,
        severity:         input.severity as DisciplineSeverity,
        status:           'OPEN',
        actionTaken:      input.actionTaken ?? null,
        reportedByUserId: actor.userId,
      },
      include: RECORD_INCLUDE,
    });

    return toDto(record);
  }

  async updateRecord(
    id: number,
    input: UpdateDisciplineRecordInput
  ): Promise<DisciplineRecordDto> {
    const existing = await prisma.disciplineRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Discipline record');

    const record = await prisma.disciplineRecord.update({
      where: { id },
      data: {
        ...(input.status      !== undefined && { status:      input.status as DisciplineStatus }),
        ...(input.actionTaken !== undefined && { actionTaken: input.actionTaken }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.severity    !== undefined && { severity:    input.severity as DisciplineSeverity }),
      },
      include: RECORD_INCLUDE,
    });

    return toDto(record);
  }
}

export const disciplineService = new DisciplineService();
