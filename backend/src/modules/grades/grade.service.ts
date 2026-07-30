import { GradeCategory, Prisma, RoleName, Semester } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CreateGradeComponentInput,
  GradeComponentQuery,
  RecordComponentEntriesInput,
  StudentGradesQuery,
} from './validation/grade.validation';
import {
  ClassroomSubjectTotalDto,
  ComponentRosterDto,
  GradeComponentDto,
  GradeEntryResultDto,
  GradeSchemeDto,
  SubjectGradeBreakdownDto,
} from './dto/grade.dto';

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const SCHEME_MAX_TOTAL = 100;

function toComponentDto(c: { gradeComponentId: number; teacherSubjectId: number; semester: Semester; academicYear: string; category: GradeCategory; name: string; maxMarks: Prisma.Decimal }): GradeComponentDto {
  return {
    gradeComponentId: c.gradeComponentId,
    teacherSubjectId: c.teacherSubjectId,
    semester: c.semester,
    academicYear: c.academicYear,
    category: c.category,
    name: c.name,
    maxMarks: Number(c.maxMarks),
  };
}

async function getTeacherIdForUser(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile is associated with this account');
  return teacher.teacherId;
}

async function assertTeacherOwnsTeacherSubject(teacherId: number, teacherSubjectId: number) {
  const teacherSubject = await prisma.teacherSubject.findUnique({ where: { id: teacherSubjectId } });
  if (!teacherSubject) throw new NotFoundError('Teaching assignment');
  if (teacherSubject.teacherId !== teacherId) {
    throw new ForbiddenError('You may only manage grades for subjects you teach');
  }
  return teacherSubject;
}

export class GradeService {
  /**
   * Adds one assessment component (e.g. "Quiz 1", worth 10 marks) to a
   * subject's grading scheme for a semester. FINAL_EXAM is capped at exactly
   * 50 marks and only one is allowed per scheme; every component together
   * may never exceed 100 marks, though the scheme can be built up gradually
   * — it doesn't need to total 100 immediately.
   */
  async createComponent(actor: AuthenticatedUser, input: CreateGradeComponentInput): Promise<GradeComponentDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    await assertTeacherOwnsTeacherSubject(teacherId, input.teacherSubjectId);

    const existing = await prisma.gradeComponent.findMany({
      where: { teacherSubjectId: input.teacherSubjectId, semester: input.semester, academicYear: input.academicYear },
    });

    if (input.category === GradeCategory.FINAL_EXAM && existing.some((c) => c.category === GradeCategory.FINAL_EXAM)) {
      throw new ConflictError('A Final Exam component already exists for this subject and semester');
    }

    const currentTotal = existing.reduce((sum, c) => sum + Number(c.maxMarks), 0);
    if (currentTotal + input.maxMarks > SCHEME_MAX_TOTAL) {
      throw new ConflictError(
        `Adding this component would exceed ${SCHEME_MAX_TOTAL} total marks (currently ${currentTotal}/${SCHEME_MAX_TOTAL} allocated)`
      );
    }

    const created = await prisma.gradeComponent.create({ data: input });
    return toComponentDto(created);
  }

  async deleteComponent(actor: AuthenticatedUser, gradeComponentId: number): Promise<void> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    const component = await prisma.gradeComponent.findUnique({
      where: { gradeComponentId },
      include: { teacherSubject: true },
    });
    if (!component) throw new NotFoundError('Grade component');
    if (component.teacherSubject.teacherId !== teacherId) {
      throw new ForbiddenError('You may only manage grades for subjects you teach');
    }
    await prisma.gradeComponent.delete({ where: { gradeComponentId } });
  }

  /** The full component scheme for one subject/semester, with an allocation summary. */
  async listComponents(actor: AuthenticatedUser, query: GradeComponentQuery): Promise<GradeSchemeDto> {
    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      if (actor.role !== RoleName.TEACHER) throw new ForbiddenError();
      const teacherId = await getTeacherIdForUser(actor.userId);
      await assertTeacherOwnsTeacherSubject(teacherId, query.teacherSubjectId);
    }

    const components = await prisma.gradeComponent.findMany({
      where: { teacherSubjectId: query.teacherSubjectId, semester: query.semester, academicYear: query.academicYear },
      orderBy: { createdAt: 'asc' },
    });

    const totalMaxMarks = components.reduce((sum, c) => sum + Number(c.maxMarks), 0);

    return {
      components: components.map(toComponentDto),
      totalMaxMarks,
      remainingMarks: SCHEME_MAX_TOTAL - totalMaxMarks,
      hasFinalExam: components.some((c) => c.category === GradeCategory.FINAL_EXAM),
    };
  }

  /** Bulk-upserts one component's scores across a set of students. */
  async recordComponentEntries(
    actor: AuthenticatedUser,
    gradeComponentId: number,
    input: RecordComponentEntriesInput
  ): Promise<GradeEntryResultDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    const component = await prisma.gradeComponent.findUnique({
      where: { gradeComponentId },
      include: { teacherSubject: true },
    });
    if (!component) throw new NotFoundError('Grade component');
    if (component.teacherSubject.teacherId !== teacherId) {
      throw new ForbiddenError('You may only manage grades for subjects you teach');
    }

    const studentIds = input.records.map((r) => r.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestError('Duplicate studentId entries in the score batch');
    }

    const maxMarks = Number(component.maxMarks);
    const overMax = input.records.find((r) => r.score > maxMarks);
    if (overMax) {
      throw new BadRequestError(`Score cannot exceed ${maxMarks} for "${component.name}"`);
    }

    const studentsInClassroom = await prisma.student.findMany({
      where: { classroomId: component.teacherSubject.classroomId, studentId: { in: studentIds } },
      select: { studentId: true },
    });
    if (studentsInClassroom.length !== studentIds.length) {
      const found = new Set(studentsInClassroom.map((s) => s.studentId));
      const missing = studentIds.filter((id) => !found.has(id));
      throw new BadRequestError(`These students are not enrolled in this classroom: ${missing.join(', ')}`);
    }

    await prisma.$transaction(
      input.records.map((r) =>
        prisma.gradeEntry.upsert({
          where: { gradeComponentId_studentId: { gradeComponentId, studentId: r.studentId } },
          create: { gradeComponentId, studentId: r.studentId, score: r.score },
          update: { score: r.score },
        })
      )
    );

    return { gradeComponentId, recordsSaved: input.records.length };
  }

  /** One component's full class roster with each student's current score (or null if ungraded). */
  async getComponentRoster(actor: AuthenticatedUser, gradeComponentId: number): Promise<ComponentRosterDto> {
    const component = await prisma.gradeComponent.findUnique({
      where: { gradeComponentId },
      include: { teacherSubject: true },
    });
    if (!component) throw new NotFoundError('Grade component');

    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      const teacherId = await getTeacherIdForUser(actor.userId);
      if (component.teacherSubject.teacherId !== teacherId) throw new ForbiddenError();
    }

    const [roster, entries] = await Promise.all([
      prisma.student.findMany({
        where: { classroomId: component.teacherSubject.classroomId },
        orderBy: { firstName: 'asc' },
      }),
      prisma.gradeEntry.findMany({ where: { gradeComponentId } }),
    ]);

    const scoreByStudent = new Map(entries.map((e) => [e.studentId, Number(e.score)]));

    return {
      component: toComponentDto(component),
      roster: roster.map((s) => ({
        studentId: s.studentId,
        studentName: `${s.firstName} ${s.lastName}`,
        score: scoreByStudent.get(s.studentId) ?? null,
      })),
    };
  }

  /** Every student's running total (sum of scores / sum of max marks) for one subject/semester scheme. */
  async getClassroomTotals(actor: AuthenticatedUser, query: GradeComponentQuery): Promise<ClassroomSubjectTotalDto[]> {
    const teacherSubject = await prisma.teacherSubject.findUnique({ where: { id: query.teacherSubjectId } });
    if (!teacherSubject) throw new NotFoundError('Teaching assignment');

    if (!OVERSIGHT_ROLES.includes(actor.role)) {
      const teacherId = await getTeacherIdForUser(actor.userId);
      if (teacherSubject.teacherId !== teacherId) throw new ForbiddenError();
    }

    const [components, students] = await Promise.all([
      prisma.gradeComponent.findMany({
        where: { teacherSubjectId: query.teacherSubjectId, semester: query.semester, academicYear: query.academicYear },
        include: { entries: true },
      }),
      prisma.student.findMany({ where: { classroomId: teacherSubject.classroomId }, orderBy: { firstName: 'asc' } }),
    ]);

    const totalMaxMarks = components.reduce((sum, c) => sum + Number(c.maxMarks), 0);

    return students.map((s) => {
      const totalScore = components.reduce((sum, c) => {
        const entry = c.entries.find((e) => e.studentId === s.studentId);
        return sum + (entry ? Number(entry.score) : 0);
      }, 0);
      return { studentId: s.studentId, studentName: `${s.firstName} ${s.lastName}`, totalScore, totalMaxMarks };
    });
  }

  /** A student's full grade breakdown across every subject, grouped by subject/semester/year. */
  async getStudentGrades(
    actor: AuthenticatedUser,
    studentId: number,
    query: StudentGradesQuery
  ): Promise<SubjectGradeBreakdownDto[]> {
    await assertCanAccessStudentRecords(actor, studentId);

    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');

    const teacherSubjects = await prisma.teacherSubject.findMany({
      where: { classroomId: student.classroomId },
      include: { subject: true, teacher: true },
    });

    const results: SubjectGradeBreakdownDto[] = [];

    for (const ts of teacherSubjects) {
      const components = await prisma.gradeComponent.findMany({
        where: {
          teacherSubjectId: ts.id,
          ...(query.semester && { semester: query.semester }),
          ...(query.academicYear && { academicYear: query.academicYear }),
        },
        include: { entries: { where: { studentId } } },
        orderBy: { createdAt: 'asc' },
      });

      if (components.length === 0) continue;

      const bySemesterYear = new Map<string, typeof components>();
      for (const c of components) {
        const key = `${c.semester}|${c.academicYear}`;
        const list = bySemesterYear.get(key) ?? [];
        list.push(c);
        bySemesterYear.set(key, list);
      }

      for (const [key, comps] of bySemesterYear) {
        const [semester, academicYear] = key.split('|') as [Semester, string];
        const componentBreakdown = comps.map((c) => ({
          gradeComponentId: c.gradeComponentId,
          category: c.category,
          name: c.name,
          maxMarks: Number(c.maxMarks),
          score: c.entries[0] ? Number(c.entries[0].score) : null,
        }));

        results.push({
          teacherSubjectId: ts.id,
          subject: {
            subjectId: ts.subject.subjectId,
            subjectCode: ts.subject.subjectCode,
            subjectName: ts.subject.subjectName,
          },
          teacher: { teacherId: ts.teacher.teacherId, firstName: ts.teacher.firstName, lastName: ts.teacher.lastName },
          semester,
          academicYear,
          components: componentBreakdown,
          totalScore: componentBreakdown.reduce((sum, c) => sum + (c.score ?? 0), 0),
          totalMaxMarks: componentBreakdown.reduce((sum, c) => sum + c.maxMarks, 0),
        });
      }
    }

    return results.sort(
      (a, b) => b.academicYear.localeCompare(a.academicYear) || a.subject.subjectName.localeCompare(b.subject.subjectName)
    );
  }
}

export const gradeService = new GradeService();
