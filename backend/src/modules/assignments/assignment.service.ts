import { Prisma, SubmissionStatus } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import {
  CreateAssignmentInput,
  ListAssignmentsQuery,
  MarkMySubmissionInput,
  UpdateSubmissionStatusInput,
} from './validation/assignment.validation';
import {
  AssignmentDto,
  AssignmentSubmissionDto,
  AssignmentWithSummaryDto,
  StudentAssignmentDto,
} from './dto/assignment.dto';

const TEACHER_SUBJECT_INCLUDE = {
  teacher: true,
  subject: true,
  classroom: true,
} satisfies Prisma.TeacherSubjectInclude;

const ASSIGNMENT_INCLUDE = {
  teacherSubject: { include: TEACHER_SUBJECT_INCLUDE },
} satisfies Prisma.AssignmentInclude;

type AssignmentWithRelations = Prisma.AssignmentGetPayload<{ include: typeof ASSIGNMENT_INCLUDE }>;
type SubmissionWithStudent = Prisma.AssignmentSubmissionGetPayload<{ include: { student: true } }>;

function toAssignmentDto(a: AssignmentWithRelations): AssignmentDto {
  return {
    assignmentId: a.assignmentId,
    title: a.title,
    description: a.description,
    dueDate: a.dueDate.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    teacherSubject: {
      id: a.teacherSubject.id,
      teacher: {
        teacherId: a.teacherSubject.teacher.teacherId,
        firstName: a.teacherSubject.teacher.firstName,
        lastName: a.teacherSubject.teacher.lastName,
      },
      subject: {
        subjectId: a.teacherSubject.subject.subjectId,
        subjectCode: a.teacherSubject.subject.subjectCode,
        subjectName: a.teacherSubject.subject.subjectName,
      },
      classroom: {
        classroomId: a.teacherSubject.classroom.classroomId,
        className: a.teacherSubject.classroom.className,
        section: a.teacherSubject.classroom.section,
        academicYear: a.teacherSubject.classroom.academicYear,
      },
    },
  };
}

function toSubmissionDto(s: SubmissionWithStudent): AssignmentSubmissionDto {
  return {
    submissionId: s.submissionId,
    assignmentId: s.assignmentId,
    status: s.status,
    submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
    notes: s.notes,
    updatedAt: s.updatedAt.toISOString(),
    student: {
      studentId: s.student.studentId,
      firstName: s.student.firstName,
      lastName: s.student.lastName,
      admissionNumber: s.student.admissionNumber,
    },
  };
}

async function getTeacherIdForUser(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile is associated with this account');
  return teacher.teacherId;
}

async function assertTeacherOwnsAssignment(teacherId: number, assignmentId: number) {
  const assignment = await prisma.assignment.findUnique({
    where: { assignmentId },
    include: { teacherSubject: true },
  });
  if (!assignment) throw new NotFoundError('Assignment');
  if (assignment.teacherSubject.teacherId !== teacherId) {
    throw new ForbiddenError('You may only manage assignments you created');
  }
  return assignment;
}

export class AssignmentService {
  /**
   * Creates an assignment for one of the teacher's own teaching assignments
   * and seeds a NOT_SUBMITTED tracking row for every student currently
   * enrolled in that classroom, so completion can be checked off per student.
   */
  async createAssignment(actor: AuthenticatedUser, input: CreateAssignmentInput): Promise<AssignmentDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);

    const teacherSubject = await prisma.teacherSubject.findUnique({ where: { id: input.teacherSubjectId } });
    if (!teacherSubject) throw new NotFoundError('Teaching assignment');
    if (teacherSubject.teacherId !== teacherId) {
      throw new ForbiddenError('You may only set assignments for subjects you teach');
    }

    const roster = await prisma.student.findMany({
      where: { classroomId: teacherSubject.classroomId },
      select: { studentId: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.create({
        data: {
          teacherSubjectId: input.teacherSubjectId,
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
        },
        include: ASSIGNMENT_INCLUDE,
      });

      if (roster.length > 0) {
        await tx.assignmentSubmission.createMany({
          data: roster.map((s) => ({ assignmentId: assignment.assignmentId, studentId: s.studentId })),
        });
      }

      return assignment;
    });

    return toAssignmentDto(created);
  }

  /** A teacher's own assignments (optionally narrowed to one teaching assignment), each with a completion summary. */
  async listForTeacherUser(userId: number, query: ListAssignmentsQuery): Promise<AssignmentWithSummaryDto[]> {
    const teacherId = await getTeacherIdForUser(userId);

    const assignments = await prisma.assignment.findMany({
      where: {
        teacherSubject: {
          teacherId,
          ...(query.teacherSubjectId && { id: query.teacherSubjectId }),
        },
      },
      include: { ...ASSIGNMENT_INCLUDE, submissions: true },
      orderBy: { dueDate: 'desc' },
    });

    return assignments.map((a) => {
      const submitted = a.submissions.filter((s) => s.status === SubmissionStatus.SUBMITTED).length;
      const late = a.submissions.filter((s) => s.status === SubmissionStatus.LATE).length;
      const total = a.submissions.length;
      return {
        ...toAssignmentDto(a),
        submissionSummary: { total, submitted, late, notSubmitted: total - submitted - late },
      };
    });
  }

  /** Full per-student submission checklist for one assignment (teacher view). */
  async getSubmissions(actor: AuthenticatedUser, assignmentId: number): Promise<AssignmentSubmissionDto[]> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    await assertTeacherOwnsAssignment(teacherId, assignmentId);

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId },
      include: { student: true },
      orderBy: { student: { firstName: 'asc' } },
    });

    return submissions.map(toSubmissionDto);
  }

  /** Teacher correction: manually set a specific student's submission status. */
  async updateSubmissionStatus(
    actor: AuthenticatedUser,
    assignmentId: number,
    studentId: number,
    input: UpdateSubmissionStatusInput
  ): Promise<AssignmentSubmissionDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    await assertTeacherOwnsAssignment(teacherId, assignmentId);

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId } },
    });
    if (!submission) throw new NotFoundError('Submission record');

    const updated = await prisma.assignmentSubmission.update({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      data: {
        status: input.status,
        notes: input.notes,
        submittedAt: input.status === SubmissionStatus.NOT_SUBMITTED ? null : (submission.submittedAt ?? new Date()),
      },
      include: { student: true },
    });

    return toSubmissionDto(updated);
  }

  async deleteAssignment(actor: AuthenticatedUser, assignmentId: number): Promise<void> {
    const teacherId = await getTeacherIdForUser(actor.userId);
    await assertTeacherOwnsAssignment(teacherId, assignmentId);
    await prisma.assignment.delete({ where: { assignmentId } });
  }

  /** A student's own classroom assignments (every subject), each merged with their own submission status. */
  async listForStudentUser(userId: number): Promise<StudentAssignmentDto[]> {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenError('No student profile is associated with this account');

    const assignments = await prisma.assignment.findMany({
      where: { teacherSubject: { classroomId: student.classroomId } },
      include: {
        ...ASSIGNMENT_INCLUDE,
        submissions: { where: { studentId: student.studentId } },
      },
      orderBy: { dueDate: 'asc' },
    });

    return assignments.map((a) => {
      const mine = a.submissions[0];
      return {
        ...toAssignmentDto(a),
        mySubmission: {
          status: mine?.status ?? SubmissionStatus.NOT_SUBMITTED,
          submittedAt: mine?.submittedAt ? mine.submittedAt.toISOString() : null,
          notes: mine?.notes ?? null,
        },
      };
    });
  }

  /** Student self-report: mark their own assignment as done (or undone). */
  async markMySubmission(userId: number, assignmentId: number, input: MarkMySubmissionInput): Promise<AssignmentSubmissionDto> {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenError('No student profile is associated with this account');

    const assignment = await prisma.assignment.findUnique({ where: { assignmentId } });
    if (!assignment) throw new NotFoundError('Assignment');

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.studentId } },
    });
    if (!existing) throw new NotFoundError('Submission record');

    const now = new Date();
    const status = !input.submitted
      ? SubmissionStatus.NOT_SUBMITTED
      : now > assignment.dueDate
        ? SubmissionStatus.LATE
        : SubmissionStatus.SUBMITTED;

    const updated = await prisma.assignmentSubmission.update({
      where: { assignmentId_studentId: { assignmentId, studentId: student.studentId } },
      data: {
        status,
        notes: input.notes,
        submittedAt: input.submitted ? now : null,
      },
      include: { student: true },
    });

    return toSubmissionDto(updated);
  }
}

export const assignmentService = new AssignmentService();
