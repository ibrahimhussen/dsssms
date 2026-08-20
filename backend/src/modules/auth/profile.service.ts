import { RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { UnauthorizedError } from '../../core/errors/app-error';

/**
 * Returns role-specific profile details for the authenticated user.
 * Only returns data the user is entitled to see about themselves.
 */
export async function getFullProfile(userId: number) {
  const user = await prisma.user.findUnique({
    where: { userId },
    include: {
      role: true,
      administrator: true,
      director: true,
      viceDirector: true,
      teacher: {
        include: {
          subjectAssignments: { include: { subject: true, classroom: true } },
          classroomsAsHomeroom: true,
        },
      },
      student: {
        include: {
          classroom: true,
          parentLinks: { include: { parent: true } },
        },
      },
      parent: {
        include: {
          links: { include: { student: { include: { classroom: true } } } },
        },
      },
    },
  });

  if (!user) throw new UnauthorizedError();

  const base = {
    userId:              user.userId,
    username:            user.username,
    email:               user.email,
    role:                user.role.roleName as RoleName,
    status:              user.status,
    profilePicture:      user.profilePicture,
    isTemporaryPassword: user.isTemporaryPassword,
    lastLoginAt:         user.lastLoginAt?.toISOString() ?? null,
    createdAt:           user.createdAt.toISOString(),
  };

  switch (user.role.roleName as RoleName) {
    case RoleName.ADMIN:
      return { ...base, roleData: {
        firstName: user.administrator?.firstName ?? null,
        lastName:  user.administrator?.lastName  ?? null,
        fullName:  user.administrator ? `${user.administrator.firstName} ${user.administrator.lastName}` : null,
      }};

    case RoleName.DIRECTOR:
      return { ...base, roleData: {
        firstName: user.director?.firstName ?? null,
        lastName:  user.director?.lastName  ?? null,
        fullName:  user.director ? `${user.director.firstName} ${user.director.lastName}` : null,
      }};

    case RoleName.VICE_DIRECTOR:
      return { ...base, roleData: {
        firstName: user.viceDirector?.firstName ?? null,
        lastName:  user.viceDirector?.lastName  ?? null,
        fullName:  user.viceDirector ? `${user.viceDirector.firstName} ${user.viceDirector.lastName}` : null,
      }};

    case RoleName.TEACHER:
      return { ...base, roleData: {
        firstName:      user.teacher?.firstName      ?? null,
        lastName:       user.teacher?.lastName       ?? null,
        fullName:       user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName}` : null,
        qualification:  user.teacher?.qualification  ?? null,
        specialization: user.teacher?.specialization ?? null,
        phoneNumber:    user.teacher?.phoneNumber    ?? null,
        assignments: (user.teacher?.subjectAssignments ?? []).map((a) => ({
          subjectName:  a.subject.subjectName,
          className:    a.classroom.className,
          section:      a.classroom.section,
          academicYear: a.classroom.academicYear,
        })),
        homeroomClasses: (user.teacher?.classroomsAsHomeroom ?? []).map((c) => ({
          className:    c.className,
          section:      c.section,
          academicYear: c.academicYear,
        })),
      }};

    case RoleName.STUDENT:
      return { ...base, roleData: {
        studentId:       user.student?.studentId       ?? null,
        admissionNumber: user.student?.admissionNumber ?? null,
        firstName:       user.student?.firstName       ?? null,
        lastName:        user.student?.lastName        ?? null,
        fullName:        user.student ? `${user.student.firstName} ${user.student.lastName}` : null,
        gender:          user.student?.gender          ?? null,
        dateOfBirth:     user.student?.dateOfBirth?.toISOString().split('T')[0] ?? null,
        address:         user.student?.address         ?? null,
        studentStatus:   user.student?.studentStatus   ?? null,
        admissionType:   user.student?.admissionType   ?? null,
        enrolledAt:      user.student?.enrolledAt?.toISOString() ?? null,
        classroom: user.student?.classroom ? {
          classroomId:  user.student.classroom.classroomId,
          className:    user.student.classroom.className,
          section:      user.student.classroom.section,
          academicYear: user.student.classroom.academicYear,
        } : null,
        parents: (user.student?.parentLinks ?? []).map((l) => ({
          fullName:     l.parent.fullName,
          phoneNumber:  l.parent.phoneNumber,
          relationship: l.relationship,
        })),
      }};

    case RoleName.PARENT:
      return { ...base, roleData: {
        fullName:    user.parent?.fullName    ?? null,
        phoneNumber: user.parent?.phoneNumber ?? null,
        children: (user.parent?.links ?? []).map((l) => ({
          admissionNumber: l.student.admissionNumber,
          firstName:       l.student.firstName,
          lastName:        l.student.lastName,
          relationship:    l.relationship,
          classroom: l.student.classroom ? {
            className:    l.student.classroom.className,
            section:      l.student.classroom.section,
            academicYear: l.student.classroom.academicYear,
          } : null,
        })),
      }};

    default:
      return { ...base, roleData: null };
  }
}

export type FullProfile = Awaited<ReturnType<typeof getFullProfile>>;
