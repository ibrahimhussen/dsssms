import { Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { createAutoNotification } from '../notifications/notification.service';
import { NotificationCategory } from '@prisma/client';
import {
  SendMessageInput,
  ReplyMessageInput,
  ListThreadsQuery,
  ThreadQuery,
} from './validation/messaging.validation';
import { ConversationThreadDto, EligibleTeacherDto, MessageDto } from './dto/messaging.dto';
import { buildPaginationMeta, getPaginationParams, PaginationQuery } from '../../core/http/pagination';

// ── Prisma include shape ──────────────────────────────────────────────────────

const MSG_INCLUDE = {
  student:   true,
  sender:    { include: { teacher: true, parent: true } },
  recipient: { include: { teacher: true, parent: true } },
  replies: {
    include: {
      student:   true,
      sender:    { include: { teacher: true, parent: true } },
      recipient: { include: { teacher: true, parent: true } },
      replies: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ParentTeacherMessageInclude;

type MsgWithRelations = Prisma.ParentTeacherMessageGetPayload<{ include: typeof MSG_INCLUDE }>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveUserName(user: { teacher?: { firstName: string; lastName: string } | null; parent?: { fullName: string } | null; username: string }): string {
  if (user.teacher) return `${user.teacher.firstName} ${user.teacher.lastName}`;
  if (user.parent)  return user.parent.fullName;
  return user.username;
}

function toMessageDto(m: MsgWithRelations): MessageDto {
  return {
    id:              m.id,
    studentId:       m.studentId,
    studentName:     `${m.student.firstName} ${m.student.lastName}`,
    senderUserId:    m.senderUserId,
    senderName:      resolveUserName(m.sender),
    recipientUserId: m.recipientUserId,
    recipientName:   resolveUserName(m.recipient),
    body:            m.body,
    isRead:          m.isRead,
    parentMessageId: m.parentMessageId,
    createdAt:       m.createdAt.toISOString(),
    replies:         (m.replies ?? []).map((r) => toMessageDto(r as unknown as MsgWithRelations)),
  };
}

/**
 * Verify that actor (PARENT) is linked to the student, AND that the
 * recipientUserId belongs to a teacher who teaches that student's classroom.
 */
async function assertParentCanMessageTeacher(
  actor: AuthenticatedUser,
  studentId: number,
  teacherUserId: number
): Promise<void> {
  // 1. Confirm parent owns this child
  const parent = await prisma.parent.findUnique({ where: { userId: actor.userId } });
  if (!parent) throw new ForbiddenError('No parent profile');

  const link = await prisma.studentParentLink.findUnique({
    where: { studentId_parentId: { studentId, parentId: parent.parentId } },
  });
  if (!link) throw new ForbiddenError('You may only message teachers of your own linked children');

  // 2. Confirm the recipient is a teacher assigned to this student's classroom
  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) throw new NotFoundError('Student');

  const teacher = await prisma.teacher.findUnique({ where: { userId: teacherUserId } });
  if (!teacher) throw new ForbiddenError('Recipient is not a teacher in this system');

  const assignment = await prisma.teacherSubject.findFirst({
    where: { teacherId: teacher.teacherId, classroomId: student.classroomId },
  });
  if (!assignment) {
    throw new ForbiddenError('You may only message teachers who are assigned to your child\'s classroom');
  }
}

/**
 * Verify that actor (TEACHER) is assigned to the student's classroom.
 */
async function assertTeacherCanAccessConversation(
  actor: AuthenticatedUser,
  studentId: number
): Promise<void> {
  const teacher = await prisma.teacher.findUnique({ where: { userId: actor.userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile');

  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) throw new NotFoundError('Student');

  const assignment = await prisma.teacherSubject.findFirst({
    where: { teacherId: teacher.teacherId, classroomId: student.classroomId },
  });
  if (!assignment) {
    throw new ForbiddenError('You may only view conversations for students in classrooms you teach');
  }
}

// ── Service ───────────────────────────────────────────────────────────────────

export class MessagingService {
  /**
   * Returns the list of teachers a parent is eligible to message for a given child.
   * Only teachers currently assigned to the child's classroom are returned.
   */
  async getEligibleTeachers(
    actor: AuthenticatedUser,
    studentId: number
  ): Promise<EligibleTeacherDto[]> {
    if (actor.role !== RoleName.PARENT) throw new ForbiddenError();

    const parent = await prisma.parent.findUnique({ where: { userId: actor.userId } });
    if (!parent) throw new ForbiddenError('No parent profile');

    const link = await prisma.studentParentLink.findUnique({
      where: { studentId_parentId: { studentId, parentId: parent.parentId } },
    });
    if (!link) throw new ForbiddenError('You may only query teachers for your own linked children');

    const student = await prisma.student.findUnique({ where: { studentId } });
    if (!student) throw new NotFoundError('Student');

    const assignments = await prisma.teacherSubject.findMany({
      where: { classroomId: student.classroomId },
      include: { teacher: true, subject: true },
    });

    return assignments.map((a) => ({
      teacherId:   a.teacher.teacherId,
      userId:      a.teacher.userId,
      firstName:   a.teacher.firstName,
      lastName:    a.teacher.lastName,
      subjectName: a.subject.subjectName,
    }));
  }

  /**
   * Parent sends a new message to a teacher (top-level, not a reply).
   */
  async sendMessage(
    actor: AuthenticatedUser,
    input: SendMessageInput
  ): Promise<MessageDto> {
    if (actor.role !== RoleName.PARENT) throw new ForbiddenError('Only parents can initiate messages');

    await assertParentCanMessageTeacher(actor, input.studentId, input.recipientUserId);

    const created = await prisma.parentTeacherMessage.create({
      data: {
        studentId:       input.studentId,
        senderUserId:    actor.userId,
        recipientUserId: input.recipientUserId,
        body:            input.body,
      },
      include: MSG_INCLUDE,
    });

    // Notify the teacher
    void createAutoNotification({
      recipientUserId: input.recipientUserId,
      senderUserId:    actor.userId,
      studentId:       input.studentId,
      category:        NotificationCategory.ANNOUNCEMENT,
      title:           'New message from a parent',
      message:         input.body.length > 100 ? input.body.slice(0, 97) + '…' : input.body,
      relatedEntity:   'ParentTeacherMessage',
      relatedEntityId: String(created.id),
    });

    return toMessageDto(created);
  }

  /**
   * Teacher (or parent) replies to an existing message.
   */
  async replyToMessage(
    actor: AuthenticatedUser,
    parentMessageId: number,
    input: ReplyMessageInput
  ): Promise<MessageDto> {
    const original = await prisma.parentTeacherMessage.findUnique({
      where: { id: parentMessageId },
      include: { student: true },
    });
    if (!original) throw new NotFoundError('Message');

    // Access check: actor must be either the sender or recipient of the original
    const isParty = original.senderUserId === actor.userId || original.recipientUserId === actor.userId;
    if (!isParty) {
      // Also allow if it's a teacher replying and they teach the student
      if (actor.role === RoleName.TEACHER) {
        await assertTeacherCanAccessConversation(actor, original.studentId);
      } else {
        throw new ForbiddenError('You are not a participant in this conversation');
      }
    }

    // Determine recipient: the other party
    const recipientUserId =
      original.senderUserId === actor.userId ? original.recipientUserId : original.senderUserId;

    const reply = await prisma.parentTeacherMessage.create({
      data: {
        studentId:       original.studentId,
        senderUserId:    actor.userId,
        recipientUserId,
        body:            input.body,
        parentMessageId: original.parentMessageId ?? parentMessageId, // always link to root
      },
      include: MSG_INCLUDE,
    });

    // Mark the original as read when teacher replies
    if (original.recipientUserId === actor.userId && !original.isRead) {
      await prisma.parentTeacherMessage.update({
        where: { id: parentMessageId },
        data:  { isRead: true },
      });
    }

    // Notify the other party
    void createAutoNotification({
      recipientUserId,
      senderUserId:    actor.userId,
      studentId:       original.studentId,
      category:        NotificationCategory.ANNOUNCEMENT,
      title:           'New reply to your message',
      message:         input.body.length > 100 ? input.body.slice(0, 97) + '…' : input.body,
      relatedEntity:   'ParentTeacherMessage',
      relatedEntityId: String(original.parentMessageId ?? parentMessageId),
    });

    return toMessageDto(reply);
  }

  /**
   * Returns conversation threads visible to the current user.
   * PARENT: threads for their linked children.
   * TEACHER: threads for students in classrooms they teach.
   */
  async listThreads(
    actor: AuthenticatedUser,
    query: ListThreadsQuery
  ): Promise<{ items: ConversationThreadDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    const { skip, take } = getPaginationParams(query as PaginationQuery);

    let where: Prisma.ParentTeacherMessageWhereInput = {
      parentMessageId: null, // top-level messages only
    };

    if (actor.role === RoleName.PARENT) {
      const parent = await prisma.parent.findUnique({ where: { userId: actor.userId } });
      if (!parent) throw new ForbiddenError('No parent profile');

      const links = await prisma.studentParentLink.findMany({ where: { parentId: parent.parentId } });
      const studentIds = links.map((l) => l.studentId);

      where = {
        ...where,
        studentId: { in: query.studentId ? [query.studentId] : studentIds },
        OR: [{ senderUserId: actor.userId }, { recipientUserId: actor.userId }],
      };
    } else if (actor.role === RoleName.TEACHER) {
      const teacher = await prisma.teacher.findUnique({ where: { userId: actor.userId } });
      if (!teacher) throw new ForbiddenError('No teacher profile');

      const assignments = await prisma.teacherSubject.findMany({
        where: { teacherId: teacher.teacherId },
        select: { classroomId: true },
        distinct: ['classroomId'],
      });
      const classroomIds = assignments.map((a) => a.classroomId);
      const students = await prisma.student.findMany({
        where: { classroomId: { in: classroomIds } },
        select: { studentId: true },
      });
      const studentIds = students.map((s) => s.studentId);

      where = {
        ...where,
        studentId: { in: query.studentId ? [query.studentId] : studentIds },
        OR: [{ senderUserId: actor.userId }, { recipientUserId: actor.userId }],
      };
    } else {
      throw new ForbiddenError('Only parents and teachers can access messages');
    }

    const [messages, totalItems] = await Promise.all([
      prisma.parentTeacherMessage.findMany({
        where,
        include: {
          student:   true,
          sender:    { include: { teacher: true, parent: true } },
          recipient: { include: { teacher: true, parent: true } },
          replies:   { select: { id: true, isRead: true, recipientUserId: true, body: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.parentTeacherMessage.count({ where }),
    ]);

    const items: ConversationThreadDto[] = messages.map((m) => {
      const otherUser  = m.senderUserId === actor.userId ? m.recipient : m.sender;
      const otherRole  = m.senderUserId === actor.userId
        ? (m.recipient.teacher ? 'TEACHER' : 'PARENT')
        : (m.sender.teacher    ? 'TEACHER' : 'PARENT');

      // Find subject taught by the teacher for this student's classroom
      const unreadReplies = m.replies.filter(
        (r) => r.recipientUserId === actor.userId && !r.isRead
      ).length;
      const isRootUnread  = m.recipientUserId === actor.userId && !m.isRead ? 1 : 0;

      const lastReply = [...m.replies].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      return {
        otherUserId:   otherUser.userId,
        otherName:     resolveUserName(otherUser),
        otherRole,
        subjectName:   '',   // enriched below if needed — keep simple for list view
        studentId:     m.studentId,
        studentName:   `${m.student.firstName} ${m.student.lastName}`,
        lastMessage:   lastReply ? lastReply.body : m.body,
        lastMessageAt: lastReply ? lastReply.createdAt.toISOString() : m.createdAt.toISOString(),
        unreadCount:   unreadReplies + isRootUnread,
      };
    });

    return { items, meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }) };
  }

  /**
   * Returns all messages (root + replies) in a specific conversation thread.
   */
  async getThread(
    actor: AuthenticatedUser,
    query: ThreadQuery
  ): Promise<MessageDto[]> {
    // Access check
    if (actor.role === RoleName.PARENT) {
      const parent = await prisma.parent.findUnique({ where: { userId: actor.userId } });
      if (!parent) throw new ForbiddenError('No parent profile');
      const link = await prisma.studentParentLink.findUnique({
        where: { studentId_parentId: { studentId: query.studentId, parentId: parent.parentId } },
      });
      if (!link) throw new ForbiddenError('You may only view conversations for your own linked children');
    } else if (actor.role === RoleName.TEACHER) {
      await assertTeacherCanAccessConversation(actor, query.studentId);
    } else {
      throw new ForbiddenError();
    }

    const messages = await prisma.parentTeacherMessage.findMany({
      where: {
        studentId:       query.studentId,
        parentMessageId: null,
        OR: [
          { senderUserId: actor.userId,          recipientUserId: query.otherUserId },
          { senderUserId: query.otherUserId,     recipientUserId: actor.userId },
        ],
      },
      include: MSG_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread messages addressed to actor as read
    const unreadIds = messages
      .flatMap((m) => [m, ...(m.replies as unknown as typeof messages)])
      .filter((m) => m.recipientUserId === actor.userId && !m.isRead)
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await prisma.parentTeacherMessage.updateMany({
        where: { id: { in: unreadIds } },
        data:  { isRead: true },
      });
    }

    return messages.map((m) => toMessageDto(m as unknown as MsgWithRelations));
  }

  /** Returns the total number of unread messages for the current user. */
  async getUnreadCount(actor: AuthenticatedUser): Promise<number> {
    return prisma.parentTeacherMessage.count({
      where: { recipientUserId: actor.userId, isRead: false },
    });
  }
}

export const messagingService = new MessagingService();
