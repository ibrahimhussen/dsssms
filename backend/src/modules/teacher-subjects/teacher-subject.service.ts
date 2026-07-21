import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateAssignmentInput, ListAssignmentsQuery } from './validation/teacher-subject.validation';
import { TeacherSubjectAssignmentDto } from './dto/teacher-subject.dto';

const ASSIGNMENT_INCLUDE = {
  teacher: true,
  subject: true,
  classroom: true,
} satisfies Prisma.TeacherSubjectInclude;

type AssignmentWithRelations = Prisma.TeacherSubjectGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;

function toAssignmentDto(a: AssignmentWithRelations): TeacherSubjectAssignmentDto {
  return {
    id: a.id,
    teacher: { teacherId: a.teacher.teacherId, firstName: a.teacher.firstName, lastName: a.teacher.lastName },
    subject: { subjectId: a.subject.subjectId, subjectCode: a.subject.subjectCode, subjectName: a.subject.subjectName },
    classroom: {
      classroomId: a.classroom.classroomId,
      className: a.classroom.className,
      section: a.classroom.section,
      academicYear: a.classroom.academicYear,
    },
  };
}

export class TeacherSubjectService {
  async createAssignment(input: CreateAssignmentInput): Promise<TeacherSubjectAssignmentDto> {
    const [teacher, subject, classroom] = await Promise.all([
      prisma.teacher.findUnique({ where: { teacherId: input.teacherId } }),
      prisma.subject.findUnique({ where: { subjectId: input.subjectId } }),
      prisma.classroom.findUnique({ where: { classroomId: input.classroomId } }),
    ]);

    if (!teacher) throw new NotFoundError('Teacher');
    if (!subject) throw new NotFoundError('Subject');
    if (!classroom) throw new NotFoundError('Classroom');

    const existing = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId_classroomId: {
          teacherId: input.teacherId,
          subjectId: input.subjectId,
          classroomId: input.classroomId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('This teacher is already assigned to this subject for this classroom');
    }

    const created = await prisma.teacherSubject.create({ data: input, include: ASSIGNMENT_INCLUDE });
    return toAssignmentDto(created);
  }

  async listAssignments(
    query: ListAssignmentsQuery
  ): Promise<{ items: TeacherSubjectAssignmentDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.TeacherSubjectWhereInput = {
      ...(query.teacherId && { teacherId: query.teacherId }),
      ...(query.classroomId && { classroomId: query.classroomId }),
      ...(query.subjectId && { subjectId: query.subjectId }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.teacherSubject.findMany({ where, include: ASSIGNMENT_INCLUDE, skip, take, orderBy: { id: 'desc' } }),
      prisma.teacherSubject.count({ where }),
    ]);

    return {
      items: items.map(toAssignmentDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  /** A teacher viewing their own teaching assignments (used to build their timetable/roster view). */
  async listAssignmentsForTeacherUser(userId: number): Promise<TeacherSubjectAssignmentDto[]> {
    const teacher = await prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundError('Teacher profile');

    const items = await prisma.teacherSubject.findMany({
      where: { teacherId: teacher.teacherId },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { id: 'desc' },
    });

    return items.map(toAssignmentDto);
  }

  async deleteAssignment(id: number): Promise<void> {
    const assignment = await prisma.teacherSubject.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundError('Assignment');

    await prisma.teacherSubject.delete({ where: { id } });
  }

  /**
   * Authorization helper for later modules (Attendance, Grades): confirms
   * the given teacher is actually assigned to teach the given classroom
   * (optionally for a specific subject). Throws if not.
   */
  async assertTeacherAssignedToClassroom(params: {
    teacherId: number;
    classroomId: number;
    subjectId?: number;
  }): Promise<void> {
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        teacherId: params.teacherId,
        classroomId: params.classroomId,
        ...(params.subjectId && { subjectId: params.subjectId }),
      },
    });

    if (!assignment) {
      throw new NotFoundError('Teaching assignment for this teacher/classroom/subject combination');
    }
  }
}

export const teacherSubjectService = new TeacherSubjectService();
