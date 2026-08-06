import { NotificationStatus, Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { teacherSubjectService } from '../teacher-subjects/teacher-subject.service';
import { recordAudit } from '../../core/audit/audit-recorder';
import {
  BroadcastNotificationInput,
  CreateNotificationInput,
  ListAllNotificationsQuery,
  ListNotificationsQuery,
  SendToParentsInput,
} from './validation/notification.validation';
import { BroadcastResultDto, NotificationDto, SendToParentsResultDto } from './dto/notification.dto';

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const STAFF_ROLES: RoleName[] = [...OVERSIGHT_ROLES, RoleName.TEACHER];

async function getTeacherIdForUser(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile is associated with this account');
  return teacher.teacherId;
}

const NOTIFICATION_INCLUDE = { student: true } satisfies Prisma.NotificationInclude;

type NotificationWithRelations = Prisma.NotificationGetPayload<{ include: typeof NOTIFICATION_INCLUDE }>;

function toNotificationDto(n: NotificationWithRelations): NotificationDto {
  return {
    notificationId: n.notificationId,
    title: n.title,
    message: n.message,
    sentDate: n.sentDate.toISOString(),
    status: n.status,
    recipientUserId: n.recipientUserId,
    student: n.student
      ? { studentId: n.student.studentId, firstName: n.student.firstName, lastName: n.student.lastName }
      : null,
  };
}

export class NotificationService {
  /** Sends a single notification to a specific user (staff/admin broadcast or targeted message). */
  async send(input: CreateNotificationInput): Promise<NotificationDto> {
    const recipient = await prisma.user.findUnique({ where: { userId: input.recipientUserId } });
    if (!recipient) throw new NotFoundError('Recipient user');

    if (input.studentId) {
      const student = await prisma.student.findUnique({ where: { studentId: input.studentId } });
      if (!student) throw new NotFoundError('Student');
    }

    const created = await prisma.notification.create({
      data: {
        recipientUserId: input.recipientUserId,
        studentId: input.studentId,
        title: input.title,
        message: input.message,
      },
      include: NOTIFICATION_INCLUDE,
    });

    return toNotificationDto(created);
  }

  /**
   * Sends the same notification to every parent linked to a student — the
   * common "notify the parents" workflow (e.g. attendance/behavior concerns).
   * A Teacher may only do this for students in a classroom they're assigned
   * to teach (enforced by the shared assertCanAccessStudentRecords helper).
   */
  async sendToParents(
    actor: AuthenticatedUser,
    studentId: number,
    input: SendToParentsInput
  ): Promise<SendToParentsResultDto> {
    await assertCanAccessStudentRecords(actor, studentId);

    const links = await prisma.studentParentLink.findMany({ where: { studentId }, include: { parent: true } });

    if (links.length === 0) {
      throw new NotFoundError('Any parent linked to this student');
    }

    await prisma.notification.createMany({
      data: links.map((link) => ({
        recipientUserId: link.parent.userId,
        studentId,
        title: input.title,
        message: input.message,
      })),
    });

    return { studentId, notificationsSent: links.length };
  }

  /**
   * Sends the same title/message to an entire audience in one call — the
   * "Send Announcement" workflow. Oversight roles can target any audience;
   * a Teacher may only message the students or parents of a classroom
   * they're actually assigned to teach.
   */
  async broadcast(actor: AuthenticatedUser, input: BroadcastNotificationInput, ipAddress?: string): Promise<BroadcastResultDto> {
    const isOversight = OVERSIGHT_ROLES.includes(actor.role);
    const isClassroomAudience = input.audience === 'CLASSROOM_STUDENTS' || input.audience === 'CLASSROOM_PARENTS';

    if (!isOversight) {
      if (actor.role !== RoleName.TEACHER || !isClassroomAudience) {
        throw new ForbiddenError('Only oversight roles can message this audience');
      }
    }

    if (isClassroomAudience) {
      if (!input.classroomId) throw new BadRequestError('classroomId is required for this audience');
      if (actor.role === RoleName.TEACHER) {
        const teacherId = await getTeacherIdForUser(actor.userId);
        await teacherSubjectService.assertTeacherAssignedToClassroom({ teacherId, classroomId: input.classroomId });
      }
    }

    let recipientUserIds: number[] = [];

    switch (input.audience) {
      case 'ALL_STAFF': {
        const users = await prisma.user.findMany({ where: { role: { roleName: { in: STAFF_ROLES } } }, select: { userId: true } });
        recipientUserIds = users.map((u) => u.userId);
        break;
      }
      case 'ALL_TEACHERS': {
        const teachers = await prisma.teacher.findMany({ select: { userId: true } });
        recipientUserIds = teachers.map((t) => t.userId);
        break;
      }
      case 'ALL_PARENTS': {
        const parents = await prisma.parent.findMany({ select: { userId: true } });
        recipientUserIds = parents.map((p) => p.userId);
        break;
      }
      case 'ALL_STUDENTS': {
        const students = await prisma.student.findMany({ select: { userId: true } });
        recipientUserIds = students.map((s) => s.userId);
        break;
      }
      case 'CLASSROOM_STUDENTS': {
        const students = await prisma.student.findMany({ where: { classroomId: input.classroomId }, select: { userId: true } });
        recipientUserIds = students.map((s) => s.userId);
        break;
      }
      case 'CLASSROOM_PARENTS': {
        const links = await prisma.studentParentLink.findMany({
          where: { student: { classroomId: input.classroomId } },
          select: { parent: { select: { userId: true } } },
        });
        recipientUserIds = [...new Set<number>(links.map((l) => l.parent.userId))];
        break;
      }
    }

    if (recipientUserIds.length > 0) {
      await prisma.notification.createMany({
        data: recipientUserIds.map((recipientUserId) => ({
          recipientUserId,
          title: input.title,
          message: input.message,
        })),
      });
    }

    await recordAudit({
      userId: actor.userId,
      action: 'NOTIFICATION_BROADCAST',
      entity: 'Notification',
      ipAddress,
      metadata: { audience: input.audience, classroomId: input.classroomId, recipientCount: recipientUserIds.length },
    });

    return { audience: input.audience, notificationsSent: recipientUserIds.length };
  }

  async getMyNotifications(
    userId: number,
    query: ListNotificationsQuery
  ): Promise<{ items: NotificationDto[]; meta: ReturnType<typeof buildPaginationMeta>; unreadCount: number }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      ...(query.status && { status: query.status }),
    };

    const [items, totalItems, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, include: NOTIFICATION_INCLUDE, skip, take, orderBy: { sentDate: 'desc' } }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { recipientUserId: userId, status: NotificationStatus.UNREAD } }),
    ]);

    return {
      items: items.map(toNotificationDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
      unreadCount,
    };
  }

  async markAsRead(userId: number, notificationId: number): Promise<NotificationDto> {
    const notification = await prisma.notification.findUnique({ where: { notificationId } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenError('You may only manage your own notifications');
    }

    const updated = await prisma.notification.update({
      where: { notificationId },
      data: { status: NotificationStatus.READ },
      include: NOTIFICATION_INCLUDE,
    });

    return toNotificationDto(updated);
  }

  async markAllAsRead(userId: number): Promise<{ updatedCount: number }> {
    const result = await prisma.notification.updateMany({
      where: { recipientUserId: userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ },
    });

    return { updatedCount: result.count };
  }

  async delete(userId: number, notificationId: number): Promise<void> {
    const notification = await prisma.notification.findUnique({ where: { notificationId } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenError('You may only manage your own notifications');
    }

    await prisma.notification.delete({ where: { notificationId } });
  }

  /** Administrative view across all notifications — oversight/audit only. */
  async listAll(
    query: ListAllNotificationsQuery
  ): Promise<{ items: NotificationDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.NotificationWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.recipientUserId && { recipientUserId: query.recipientUserId }),
      ...(query.studentId && { studentId: query.studentId }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.notification.findMany({ where, include: NOTIFICATION_INCLUDE, skip, take, orderBy: { sentDate: 'desc' } }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: items.map(toNotificationDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }
}

export const notificationService = new NotificationService();
