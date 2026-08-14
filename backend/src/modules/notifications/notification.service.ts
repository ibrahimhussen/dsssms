import {
  NotificationCategory,
  NotificationStatus,
  Prisma,
  RoleName,
} from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { teacherSubjectService } from '../teacher-subjects/teacher-subject.service';
import { recordAudit } from '../../core/audit/audit-recorder';
import { logger } from '../../core/logger/logger';
import {
  BroadcastNotificationInput,
  CreateNotificationInput,
  ListAllNotificationsQuery,
  ListNotificationsQuery,
  SendToParentsInput,
} from './validation/notification.validation';
import { BroadcastResultDto, NotificationDto, SendToParentsResultDto } from './dto/notification.dto';

// ── Constants ─────────────────────────────────────────────────────────────────

const OVERSIGHT_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const STAFF_ROLES:     RoleName[] = [...OVERSIGHT_ROLES, RoleName.TEACHER];

// ── Prisma include shape ──────────────────────────────────────────────────────

const NOTIFICATION_INCLUDE = {
  student:    true,
  senderUser: {
    include: {
      director:      true,
      viceDirector:  true,
      administrator: true,
      teacher:       true,
    },
  },
} satisfies Prisma.NotificationInclude;

type NotificationWithRelations = Prisma.NotificationGetPayload<{
  include: typeof NOTIFICATION_INCLUDE;
}>;

// ── Mapper ────────────────────────────────────────────────────────────────────

function resolveSenderName(
  user: NotificationWithRelations['senderUser']
): string | null {
  if (!user) return null;
  if (user.director)     return `${user.director.firstName} ${user.director.lastName}`;
  if (user.viceDirector) return `${user.viceDirector.firstName} ${user.viceDirector.lastName}`;
  if (user.administrator) return `${user.administrator.firstName} ${user.administrator.lastName}`;
  if (user.teacher)      return `${user.teacher.firstName} ${user.teacher.lastName}`;
  return user.username;
}

function toNotificationDto(n: NotificationWithRelations): NotificationDto {
  return {
    notificationId:  n.notificationId,
    title:           n.title,
    message:         n.message,
    sentDate:        n.sentDate.toISOString(),
    status:          n.status,
    category:        n.category,
    recipientUserId: n.recipientUserId,
    senderUserId:    n.senderUserId,
    senderName:      resolveSenderName(n.senderUser),
    relatedEntity:   n.relatedEntity,
    relatedEntityId: n.relatedEntityId,
    student:         n.student
      ? { studentId: n.student.studentId, firstName: n.student.firstName, lastName: n.student.lastName }
      : null,
  };
}

function getTeacherIdForUser(userId: number): Promise<number> {
  return prisma.teacher
    .findUnique({ where: { userId } })
    .then((t) => {
      if (!t) throw new ForbiddenError('No teacher profile is associated with this account');
      return t.teacherId;
    });
}

// ── Internal helper — used by other services to fire automatic notifications ──

export interface AutoNotificationParams {
  recipientUserId:  number;
  senderUserId?:    number;
  studentId?:       number;
  category:         NotificationCategory;
  title:            string;
  message:          string;
  relatedEntity?:   string;
  relatedEntityId?: string;
  /** When supplied the notification is skipped if one with this key already exists */
  deduplicationKey?: string;
}

/**
 * Creates a single automatic (system-generated) notification.
 * Silently swallows errors so a notification failure never breaks the
 * primary business action that triggered it.
 *
 * If `deduplicationKey` is supplied the notification is skipped when an
 * identical key already exists in the table — prevents double-firing on
 * correction or re-execution.
 */
export async function createAutoNotification(p: AutoNotificationParams): Promise<void> {
  try {
    if (p.deduplicationKey) {
      const exists = await prisma.notification.findUnique({
        where: { deduplicationKey: p.deduplicationKey },
      });
      if (exists) return;
    }

    await prisma.notification.create({
      data: {
        recipientUserId:  p.recipientUserId,
        senderUserId:     p.senderUserId ?? null,
        studentId:        p.studentId    ?? null,
        category:         p.category,
        title:            p.title,
        message:          p.message,
        relatedEntity:    p.relatedEntity    ?? null,
        relatedEntityId:  p.relatedEntityId  ?? null,
        deduplicationKey: p.deduplicationKey ?? null,
      },
    });
  } catch (err) {
    logger.error({ err }, 'createAutoNotification failed — primary action not affected');
  }
}

/**
 * Sends automatic notifications to every parent linked to a student.
 * Used by business services (attendance, finalization, promotion).
 */
export async function notifyStudentParents(params: {
  studentId:        number;
  senderUserId?:    number;
  category:         NotificationCategory;
  title:            string;
  message:          string;
  relatedEntity?:   string;
  relatedEntityId?: string;
  deduplicationKeySuffix?: string;
}): Promise<void> {
  try {
    const links = await prisma.studentParentLink.findMany({
      where: { studentId: params.studentId },
      include: { parent: true },
    });
    await Promise.all(
      links.map((link) =>
        createAutoNotification({
          recipientUserId:  link.parent.userId,
          senderUserId:     params.senderUserId,
          studentId:        params.studentId,
          category:         params.category,
          title:            params.title,
          message:          params.message,
          relatedEntity:    params.relatedEntity,
          relatedEntityId:  params.relatedEntityId,
          deduplicationKey: params.deduplicationKeySuffix
            ? `${params.deduplicationKeySuffix}:parent:${link.parent.parentId}`
            : undefined,
        })
      )
    );
  } catch (err) {
    logger.error({ err }, 'notifyStudentParents failed');
  }
}

// ── Service class ─────────────────────────────────────────────────────────────

export class NotificationService {
  /** Sends a single targeted notification (oversight roles only via routes). */
  async send(
    actor: AuthenticatedUser,
    input: CreateNotificationInput
  ): Promise<NotificationDto> {
    const recipient = await prisma.user.findUnique({ where: { userId: input.recipientUserId } });
    if (!recipient) throw new NotFoundError('Recipient user');

    if (input.studentId) {
      const student = await prisma.student.findUnique({ where: { studentId: input.studentId } });
      if (!student) throw new NotFoundError('Student');
    }

    const created = await prisma.notification.create({
      data: {
        recipientUserId:  input.recipientUserId,
        senderUserId:     actor.userId,
        studentId:        input.studentId,
        category:         input.category ?? NotificationCategory.ANNOUNCEMENT,
        title:            input.title,
        message:          input.message,
        relatedEntity:    input.relatedEntity    ?? null,
        relatedEntityId:  input.relatedEntityId  ?? null,
      },
      include: NOTIFICATION_INCLUDE,
    });

    return toNotificationDto(created);
  }

  /**
   * Sends the same notification to every parent linked to a student.
   * Teacher may only do this for students in classrooms they teach.
   */
  async sendToParents(
    actor: AuthenticatedUser,
    studentId: number,
    input: SendToParentsInput
  ): Promise<SendToParentsResultDto> {
    await assertCanAccessStudentRecords(actor, studentId);

    const links = await prisma.studentParentLink.findMany({
      where: { studentId },
      include: { parent: true },
    });

    if (links.length === 0) {
      throw new NotFoundError('Any parent linked to this student');
    }

    await prisma.notification.createMany({
      data: links.map((link) => ({
        recipientUserId: link.parent.userId,
        senderUserId:    actor.userId,
        studentId,
        category:        NotificationCategory.ANNOUNCEMENT,
        title:           input.title,
        message:         input.message,
      })),
    });

    return { studentId, notificationsSent: links.length };
  }

  /**
   * Broadcast to a named audience. Oversight roles can target any audience;
   * teachers may only message classroom students or parents for their own classrooms.
   */
  async broadcast(
    actor: AuthenticatedUser,
    input: BroadcastNotificationInput,
    ipAddress?: string
  ): Promise<BroadcastResultDto> {
    const isOversight = OVERSIGHT_ROLES.includes(actor.role);
    const isClassroomAudience =
      input.audience === 'CLASSROOM_STUDENTS' || input.audience === 'CLASSROOM_PARENTS';

    if (!isOversight) {
      if (actor.role !== RoleName.TEACHER || !isClassroomAudience) {
        throw new ForbiddenError('Teachers may only send announcements to their own classroom students or parents');
      }
    }

    if (isClassroomAudience) {
      if (!input.classroomId) throw new BadRequestError('classroomId is required for this audience');
      if (actor.role === RoleName.TEACHER) {
        const teacherId = await getTeacherIdForUser(actor.userId);
        await teacherSubjectService.assertTeacherAssignedToClassroom({
          teacherId,
          classroomId: input.classroomId,
        });
      }
    }

    let recipientUserIds: number[] = [];

    switch (input.audience) {
      case 'ALL_STAFF': {
        const users = await prisma.user.findMany({
          where: { role: { roleName: { in: STAFF_ROLES } } },
          select: { userId: true },
        });
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
        const students = await prisma.student.findMany({
          where: { classroomId: input.classroomId },
          select: { userId: true },
        });
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
          senderUserId: actor.userId,
          category:     input.category ?? NotificationCategory.ANNOUNCEMENT,
          title:        input.title,
          message:      input.message,
        })),
      });
    }

    await recordAudit({
      userId:   actor.userId,
      action:   'NOTIFICATION_BROADCAST',
      entity:   'Notification',
      ipAddress,
      metadata: {
        audience:        input.audience,
        classroomId:     input.classroomId,
        category:        input.category,
        recipientCount:  recipientUserIds.length,
      },
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
      ...(query.status   && { status:   query.status }),
      ...(query.category && { category: query.category }),
    };

    const [items, totalItems, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        include:  NOTIFICATION_INCLUDE,
        skip,
        take,
        orderBy: { sentDate: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { recipientUserId: userId, status: NotificationStatus.UNREAD },
      }),
    ]);

    return {
      items:      items.map(toNotificationDto),
      meta:       buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
      unreadCount,
    };
  }

  /** Returns only the unread count — used by the header bell badge. */
  async getUnreadCount(userId: number): Promise<number> {
    return prisma.notification.count({
      where: { recipientUserId: userId, status: NotificationStatus.UNREAD },
    });
  }

  async markAsRead(userId: number, notificationId: number): Promise<NotificationDto> {
    const notification = await prisma.notification.findUnique({ where: { notificationId } });
    if (!notification) throw new NotFoundError('Notification');
    if (notification.recipientUserId !== userId) {
      throw new ForbiddenError('You may only manage your own notifications');
    }

    const updated = await prisma.notification.update({
      where: { notificationId },
      data:  { status: NotificationStatus.READ },
      include: NOTIFICATION_INCLUDE,
    });

    return toNotificationDto(updated);
  }

  async markAllAsRead(userId: number): Promise<{ updatedCount: number }> {
    const result = await prisma.notification.updateMany({
      where: { recipientUserId: userId, status: NotificationStatus.UNREAD },
      data:  { status: NotificationStatus.READ },
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
      ...(query.status          && { status:          query.status }),
      ...(query.category        && { category:        query.category }),
      ...(query.recipientUserId && { recipientUserId: query.recipientUserId }),
      ...(query.studentId       && { studentId:       query.studentId }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.notification.findMany({
        where,
        include:  NOTIFICATION_INCLUDE,
        skip,
        take,
        orderBy: { sentDate: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      items: items.map(toNotificationDto),
      meta:  buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }
}

export const notificationService = new NotificationService();
