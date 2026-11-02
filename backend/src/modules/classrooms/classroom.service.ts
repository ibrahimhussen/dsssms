import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ConflictError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { CreateClassroomInput, ListClassroomsQuery, UpdateClassroomInput } from './validation/classroom.validation';
import { ClassroomSummaryDto } from './dto/classroom.dto';

const CLASSROOM_INCLUDE = {
  homeroomTeacher: true,
  _count: { select: { students: true, enrollments: true } },
} satisfies Prisma.ClassroomInclude;

type ClassroomWithRelations = Prisma.ClassroomGetPayload<{ include: typeof CLASSROOM_INCLUDE }>;

/**
 * Normalises a raw DB className to consistent "Grade N" title-case format.
 * DB rows may have inconsistent casing ("grade 11", "GRADE 10") depending on
 * when and how the classroom was created. Normalising at the DTO layer ensures
 * every API consumer receives a consistent value that matches GradeSubjectConfig
 * (which always stores "Grade N") and the frontend filter logic.
 */
function normalizeClassName(rawName: string): string {
  const match = rawName.match(/(?:Grade\s*)?(\d+)/i);
  return match ? `Grade ${match[1]}` : rawName;
}

function toClassroomSummaryDto(classroom: ClassroomWithRelations): ClassroomSummaryDto {
  // Use enrollment count (historical records) when available; fall back to
  // live student pointer count (for classrooms not yet part of any promotion).
  const enrollmentCount = classroom._count.enrollments ?? 0;
  const studentCount = enrollmentCount > 0 ? enrollmentCount : classroom._count.students;

  return {
    classroomId: classroom.classroomId,
    className: normalizeClassName(classroom.className),
    section: classroom.section,
    academicYear: classroom.academicYear,
    session: classroom.session,
    homeroomTeacher: classroom.homeroomTeacher
      ? {
          teacherId: classroom.homeroomTeacher.teacherId,
          firstName: classroom.homeroomTeacher.firstName,
          lastName: classroom.homeroomTeacher.lastName,
        }
      : null,
    studentCount,
  };
}

// ── Historical roster types ───────────────────────────────────────────────────

export interface ClassroomRosterStudentDto {
  studentId: number;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  enrollmentDecision: string;
  currentClassroomId: number; // student's live classroomId (may differ from this classroom)
}

export interface ClassroomRosterDto {
  classroomId: number;
  className: string;
  section: string;
  academicYear: string;
  homeroomTeacher: { teacherId: number; firstName: string; lastName: string } | null;
  students: ClassroomRosterStudentDto[];
  isHistorical: boolean; // true when academic year != classroom's current academic year or students have moved
}

// ─────────────────────────────────────────────────────────────────────────────

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

  /**
   * Returns the full student roster for a classroom in a given academic year.
   *
   * Uses StudentEnrollment as the authoritative source when records exist,
   * so historical rosters remain intact even after promotion moves students
   * to a different classroom. Falls back to Student.classroomId for active
   * classrooms that have not yet gone through a promotion cycle.
   */
  async getClassroomRoster(classroomId: number, academicYear: string): Promise<ClassroomRosterDto> {
    const classroom = await prisma.classroom.findUnique({
      where: { classroomId },
      include: { homeroomTeacher: true },
    });
    if (!classroom) throw new NotFoundError('Classroom');

    // Check for historical enrollment records first
    const enrollmentRows = await prisma.studentEnrollment.findMany({
      where: { classroomId, academicYear },
      include: {
        student: {
          select: {
            studentId: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            gender: true,
            classroomId: true,
          },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });

    let students: ClassroomRosterStudentDto[];
    let isHistorical = false;

    if (enrollmentRows.length > 0) {
      // Historical roster from StudentEnrollment — authoritative for all years
      // that have gone through a promotion batch
      students = enrollmentRows.map((e) => ({
        studentId: e.student.studentId,
        admissionNumber: e.student.admissionNumber,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        gender: e.student.gender,
        enrollmentDecision: e.decision,
        currentClassroomId: e.student.classroomId,
      }));
      // Mark as historical if any student has moved to a different classroom
      isHistorical = students.some((s) => s.currentClassroomId !== classroomId);
    } else {
      // No enrollment records — fall back to live Student.classroomId
      // (covers active classrooms not yet processed by promotion)
      const liveStudents = await prisma.student.findMany({
        where: { classroomId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });
      students = liveStudents.map((s) => ({
        studentId: s.studentId,
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        enrollmentDecision: 'ACTIVE',
        currentClassroomId: s.classroomId,
      }));
    }

    return {
      classroomId: classroom.classroomId,
      className: normalizeClassName(classroom.className),
      section: classroom.section,
      academicYear,
      homeroomTeacher: classroom.homeroomTeacher
        ? {
            teacherId: classroom.homeroomTeacher.teacherId,
            firstName: classroom.homeroomTeacher.firstName,
            lastName: classroom.homeroomTeacher.lastName,
          }
        : null,
      students,
      isHistorical,
    };
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
