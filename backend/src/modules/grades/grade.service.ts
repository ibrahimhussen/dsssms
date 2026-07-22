import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { computeLetterGrade } from '../../core/utils/grading.util';
import { teacherSubjectService } from '../teacher-subjects/teacher-subject.service';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  BulkRecordGradesInput,
  ClassroomGradesQuery,
  StudentGradesQuery,
  UpdateGradeInput,
} from './validation/grade.validation';
import { BulkGradeResultDto, GradeRecordDto } from './dto/grade.dto';

const GRADE_INCLUDE = {
  student: true,
  subject: true,
  teacher: true,
} satisfies Prisma.GradeInclude;

type GradeWithRelations = Prisma.GradeGetPayload<{ include: typeof GRADE_INCLUDE }>;

function toGradeRecordDto(g: GradeWithRelations): GradeRecordDto {
  return {
    gradeId: g.gradeId,
    studentId: g.studentId,
    studentName: `${g.student.firstName} ${g.student.lastName}`,
    subjectId: g.subjectId,
    subjectCode: g.subject.subjectCode,
    subjectName: g.subject.subjectName,
    score: Number(g.score),
    letterGrade: g.letterGrade,
    semester: g.semester,
    academicYear: g.academicYear,
    recordedBy: { teacherId: g.teacher.teacherId, firstName: g.teacher.firstName, lastName: g.teacher.lastName },
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

async function getTeacherIdForUser(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile is associated with this account');
  return teacher.teacherId;
}

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

export class GradeService {
  /**
   * Records scores for an entire classroom roster for one subject/semester
   * in a single call. Verifies the recording teacher is actually assigned
   * to teach that subject in that classroom before allowing the write.
   */
  async recordBulkGrades(actor: AuthenticatedUser, input: BulkRecordGradesInput): Promise<BulkGradeResultDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);

    await teacherSubjectService.assertTeacherAssignedToClassroom({
      teacherId,
      classroomId: input.classroomId,
      subjectId: input.subjectId,
    });

    const studentIds = input.records.map((r) => r.studentId);
    const uniqueStudentIds = new Set(studentIds);
    if (uniqueStudentIds.size !== studentIds.length) {
      throw new BadRequestError('Duplicate studentId entries in the grade batch');
    }

    const studentsInClassroom = await prisma.student.findMany({
      where: { classroomId: input.classroomId, studentId: { in: studentIds } },
      select: { studentId: true },
    });

    if (studentsInClassroom.length !== studentIds.length) {
      const found = new Set(studentsInClassroom.map((s) => s.studentId));
      const missing = studentIds.filter((id) => !found.has(id));
      throw new BadRequestError(`These students are not enrolled in classroom ${input.classroomId}: ${missing.join(', ')}`);
    }

    await prisma.$transaction(
      input.records.map((record) =>
        prisma.grade.upsert({
          where: {
            studentId_subjectId_semester_academicYear: {
              studentId: record.studentId,
              subjectId: input.subjectId,
              semester: input.semester,
              academicYear: input.academicYear,
            },
          },
          create: {
            studentId: record.studentId,
            subjectId: input.subjectId,
            teacherId,
            score: record.score,
            letterGrade: computeLetterGrade(record.score),
            semester: input.semester,
            academicYear: input.academicYear,
          },
          update: {
            teacherId,
            score: record.score,
            letterGrade: computeLetterGrade(record.score),
          },
        })
      )
    );

    return {
      classroomId: input.classroomId,
      subjectId: input.subjectId,
      semester: input.semester,
      academicYear: input.academicYear,
      recordsSaved: input.records.length,
    };
  }

  async updateGrade(actor: AuthenticatedUser, gradeId: number, input: UpdateGradeInput): Promise<GradeRecordDto> {
    const record = await prisma.grade.findUnique({ where: { gradeId }, include: GRADE_INCLUDE });
    if (!record) throw new NotFoundError('Grade record');

    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      const teacherId = await getTeacherIdForUser(actor.userId);
      if (record.teacherId !== teacherId) {
        throw new ForbiddenError('You may only correct grades you recorded yourself');
      }
    }

    const updated = await prisma.grade.update({
      where: { gradeId },
      data: { score: input.score, letterGrade: computeLetterGrade(input.score) },
      include: GRADE_INCLUDE,
    });

    return toGradeRecordDto(updated);
  }

  async getClassroomGrades(actor: AuthenticatedUser, query: ClassroomGradesQuery): Promise<GradeRecordDto[]> {
    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      if (actor.role !== RoleName.TEACHER) throw new ForbiddenError();
      const teacherId = await getTeacherIdForUser(actor.userId);
      await teacherSubjectService.assertTeacherAssignedToClassroom({
        teacherId,
        classroomId: query.classroomId,
        subjectId: query.subjectId,
      });
    }

    const records = await prisma.grade.findMany({
      where: {
        subjectId: query.subjectId,
        semester: query.semester,
        academicYear: query.academicYear,
        student: { classroomId: query.classroomId },
      },
      include: GRADE_INCLUDE,
      orderBy: { student: { firstName: 'asc' } },
    });

    return records.map(toGradeRecordDto);
  }

  async getStudentGrades(
    actor: AuthenticatedUser,
    studentId: number,
    query: StudentGradesQuery
  ): Promise<{ items: GradeRecordDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    await assertCanAccessStudentRecords(actor, studentId);

    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.GradeWhereInput = {
      studentId,
      ...(query.semester && { semester: query.semester }),
      ...(query.academicYear && { academicYear: query.academicYear }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.grade.findMany({
        where,
        include: GRADE_INCLUDE,
        skip,
        take,
        orderBy: [{ academicYear: 'desc' }, { semester: 'asc' }],
      }),
      prisma.grade.count({ where }),
    ]);

    return {
      items: items.map(toGradeRecordDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }
}

export const gradeService = new GradeService();
