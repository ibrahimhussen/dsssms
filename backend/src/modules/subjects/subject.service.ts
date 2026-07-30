import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateSubjectInput, ListSubjectsQuery, UpdateSubjectInput } from './validation/subject.validation';
import { SubjectSummaryDto } from './dto/subject.dto';

function toSubjectSummaryDto(subject: { subjectId: number; subjectCode: string; subjectName: string }): SubjectSummaryDto {
  return { subjectId: subject.subjectId, subjectCode: subject.subjectCode, subjectName: subject.subjectName };
}

export class SubjectService {
  async createSubject(input: CreateSubjectInput): Promise<SubjectSummaryDto> {
    const existing = await prisma.subject.findUnique({ where: { subjectCode: input.subjectCode } });
    if (existing) throw new ConflictError('A subject with this code already exists');

    const created = await prisma.subject.create({ data: input });
    return toSubjectSummaryDto(created);
  }

  async listSubjects(
    query: ListSubjectsQuery
  ): Promise<{ items: SubjectSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.SubjectWhereInput = query.search
      ? { OR: [{ subjectName: { contains: query.search } }, { subjectCode: { contains: query.search } }] }
      : {};

    const [items, totalItems] = await Promise.all([
      prisma.subject.findMany({ where, skip, take, orderBy: { subjectName: 'asc' } }),
      prisma.subject.count({ where }),
    ]);

    return {
      items: items.map(toSubjectSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  async getSubjectById(subjectId: number): Promise<SubjectSummaryDto> {
    const subject = await prisma.subject.findUnique({ where: { subjectId } });
    if (!subject) throw new NotFoundError('Subject');
    return toSubjectSummaryDto(subject);
  }

  async updateSubject(subjectId: number, input: UpdateSubjectInput): Promise<SubjectSummaryDto> {
    await this.assertExists(subjectId);

    if (input.subjectCode) {
      const codeOwner = await prisma.subject.findUnique({ where: { subjectCode: input.subjectCode } });
      if (codeOwner && codeOwner.subjectId !== subjectId) {
        throw new ConflictError('A subject with this code already exists');
      }
    }

    const updated = await prisma.subject.update({ where: { subjectId }, data: input });
    return toSubjectSummaryDto(updated);
  }

  async deleteSubject(subjectId: number): Promise<void> {
    await this.assertExists(subjectId);

    const assignmentCount = await prisma.teacherSubject.count({ where: { subjectId } });
    if (assignmentCount > 0) {
      throw new ConflictError('Cannot delete a subject that is currently assigned to teachers/classrooms');
    }

    await prisma.subject.delete({ where: { subjectId } });
  }

  private async assertExists(subjectId: number) {
    const subject = await prisma.subject.findUnique({ where: { subjectId } });
    if (!subject) throw new NotFoundError('Subject');
    return subject;
  }
}

export const subjectService = new SubjectService();
