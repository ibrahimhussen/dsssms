import { RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ForbiddenError, NotFoundError } from '../errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

/**
 * Confirms the authenticated user is permitted to view a given student's
 * records, per the proposal's RBAC matrix:
 *  - Admin / Director / Vice Director: unrestricted (oversight).
 *  - Student: only their own records.
 *  - Parent: only records of a student they are linked to.
 *  - Teacher: only records of students in a classroom they are assigned to teach.
 * Throws ForbiddenError (or NotFoundError if the student itself doesn't exist)
 * when access is not permitted.
 */
export async function assertCanAccessStudentRecords(user: AuthenticatedUser, studentId: number): Promise<void> {
  if (OVERSIGHT_ROLES.includes(user.role)) {
    return;
  }

  if (user.role === RoleName.STUDENT) {
    const student = await prisma.student.findUnique({ where: { userId: user.userId } });
    if (!student || student.studentId !== studentId) {
      throw new ForbiddenError('You may only view your own records');
    }
    return;
  }

  if (user.role === RoleName.PARENT) {
    const parent = await prisma.parent.findUnique({ where: { userId: user.userId } });
    if (!parent) throw new ForbiddenError();

    const link = await prisma.studentParentLink.findUnique({
      where: { studentId_parentId: { studentId, parentId: parent.parentId } },
    });

    if (!link) {
      throw new ForbiddenError('You may only view records of your own linked children');
    }
    return;
  }

  if (user.role === RoleName.TEACHER) {
    const teacher = await prisma.teacher.findUnique({ where: { userId: user.userId } });
    if (!teacher) throw new ForbiddenError();

    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');

    const assignment = await prisma.teacherSubject.findFirst({
      where: { teacherId: teacher.teacherId, classroomId: student.classroomId },
    });

    if (!assignment) {
      throw new ForbiddenError('You may only view records of students in classrooms you teach');
    }
    return;
  }

  throw new ForbiddenError();
}
