import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateClassroomInput, ListClassroomsQuery, UpdateClassroomInput } from './validation/classroom.validation';
import { ClassroomSummaryDto } from './dto/classroom.dto';

const CLASSROOM_INCLUDE = {
  homeroomTeacher: true,
  _count: { select: { students: true } },
} satisfies Prisma.ClassroomInclude;

type ClassroomWithRelations = Prisma.ClassroomGetPayload<{ include: typeof CLASSROOM_INCLUDE }>;

function toClassroomSummaryDto(classroom: ClassroomWithRelations): ClassroomSummaryDto {
  return {
    classroomId: classroom.classroomId,
    className: classroom.className,
    section: classroom.section,
    academicYear: classroom.academicYear,
    homeroomTeacher: classroom.homeroomTeacher
      ? {
          teacherId: classroom.homeroomTeacher.teacherId,
          firstName: classroom.homeroomTeacher.firstName,
          lastName: classroom.homeroomTeacher.lastName,
        }
      : null,
    studentCount: classroom._count.students,
  };
}

export class ClassroomService {
  async createClassroom(input: CreateClassroomInput): Promise<ClassroomSummaryDto> {
    if (input.homeroomTeacherId) {
      await this.assertTeacherExists(input.homeroomTeacherId);
    }

    const existing = await prisma.classroom.findUnique({
      where: {
        className_section_academicYear: {
          className: input.className,
          section: input.section,
          academicYear: input.academicYear,
        },
      },
    });

    if (existing) {
      throw new ConflictError('A classroom with this name, section, and academic year already exists');
    }

    const created = await prisma.classroom.create({ data: input, include: CLASSROOM_INCLUDE });
    return toClassroomSummaryDto(created);
  }

  async listClassrooms(
    query: ListClassroomsQuery
  ): Promise<{ items: ClassroomSummaryDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.ClassroomWhereInput = {
      ...(query.academicYear && { academicYear: query.academicYear }),
      ...(query.search && {
        OR: [{ className: { contains: query.search } }, { section: { contains: query.search } }],
      }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.classroom.findMany({
        where,
        include: CLASSROOM_INCLUDE,
        skip,
        take,
        orderBy: [{ academicYear: 'desc' }, { className: 'asc' }, { section: 'asc' }],
      }),
      prisma.classroom.count({ where }),
    ]);

    return {
      items: items.map(toClassroomSummaryDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  async getClassroomById(classroomId: number): Promise<ClassroomSummaryDto> {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId }, include: CLASSROOM_INCLUDE });
    if (!classroom) throw new NotFoundError('Classroom');
    return toClassroomSummaryDto(classroom);
  }

  async updateClassroom(classroomId: number, input: UpdateClassroomInput): Promise<ClassroomSummaryDto> {
    await this.assertExists(classroomId);

    if (input.homeroomTeacherId) {
      await this.assertTeacherExists(input.homeroomTeacherId);
    }

    const updated = await prisma.classroom.update({
      where: { classroomId },
      data: input,
      include: CLASSROOM_INCLUDE,
    });

    return toClassroomSummaryDto(updated);
  }

  async deleteClassroom(classroomId: number): Promise<void> {
    const classroom = await prisma.classroom.findUnique({
      where: { classroomId },
      include: { _count: { select: { students: true } } },
    });

    if (!classroom) throw new NotFoundError('Classroom');

    if (classroom._count.students > 0) {
      throw new ConflictError('Cannot delete a classroom that still has students enrolled. Transfer them first.');
    }

    await prisma.classroom.delete({ where: { classroomId } });
  }

  private async assertExists(classroomId: number) {
    const classroom = await prisma.classroom.findUnique({ where: { classroomId } });
    if (!classroom) throw new NotFoundError('Classroom');
    return classroom;
  }

  private async assertTeacherExists(teacherId: number) {
    const teacher = await prisma.teacher.findUnique({ where: { teacherId } });
    if (!teacher) throw new NotFoundError('Teacher');
    return teacher;
  }
}

export const classroomService = new ClassroomService();
