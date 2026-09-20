/**
 * Phase 4.8 — MessagingService Tests
 * DATABASE SAFETY: all Prisma mocked.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { MessagingService } from '../messaging.service';

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    parent:                 { findUnique: vi.fn() },
    teacher:                { findUnique: vi.fn() },
    student:                { findUnique: vi.fn(), findMany: vi.fn() },
    studentParentLink:      { findUnique: vi.fn(), findMany: vi.fn() },
    teacherSubject:         { findFirst: vi.fn(), findMany: vi.fn() },
    parentTeacherMessage:   {
      findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
      create: vi.fn(), update: vi.fn(), updateMany: vi.fn(),
    },
  },
}));
vi.mock('../../../config/env', () => ({ env: { NODE_ENV: 'test' }, isProduction: false }));
vi.mock('../../notifications/notification.service', () => ({ createAutoNotification: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../../database/prisma-client';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const PAR  = { userId: 6, role: 'PARENT'  as const, username: 'par' };
const TCH  = { userId: 4, role: 'TEACHER' as const, username: 'tch' };
const STU_ACTOR = { userId: 5, role: 'STUDENT' as const, username: 'stu' };
const DIR  = { userId: 1, role: 'DIRECTOR' as const, username: 'dir' };

const PARENT  = { parentId: 10, userId: 6, fullName: 'Papa P' };
const TEACHER = { teacherId: 100, userId: 4, firstName: 'Tom', lastName: 'T' };
const STUDENT = { studentId: 101, classroomId: 1, userId: 5, firstName: 'Alice', lastName: 'A' };

const SENDER_USER = {
  userId: 6, username: 'par',
  teacher: null, parent: PARENT,
};
const RECIP_USER = {
  userId: 4, username: 'tch',
  teacher: TEACHER, parent: null,
};

function mkMsg(id = 1, overrides: Record<string, unknown> = {}) {
  return {
    id, studentId: 101, senderUserId: 6, recipientUserId: 4,
    body: 'Hello teacher', isRead: false, parentMessageId: null,
    createdAt: new Date(), updatedAt: new Date(),
    student: STUDENT,
    sender: SENDER_USER,
    recipient: RECIP_USER,
    replies: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MessagingService', () => {
  let svc: MessagingService;
  beforeEach(() => { svc = new MessagingService(); vi.clearAllMocks(); });

  // getEligibleTeachers
  describe('getEligibleTeachers', () => {
    it('returns list of teachers assigned to the student\'s classroom', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      (prisma.student.findUnique as Mock).mockResolvedValue(STUDENT);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([
        { teacher: TEACHER, subject: { subjectName: 'English' } },
      ]);
      const r = await svc.getEligibleTeachers(PAR, 101);
      expect(r).toHaveLength(1);
      expect(r[0].firstName).toBe('Tom');
      expect(r[0].subjectName).toBe('English');
    });

    it('throws ForbiddenError for non-PARENT role', async () => {
      await expect(svc.getEligibleTeachers(TCH, 101)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError when parent has no profile', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.getEligibleTeachers(PAR, 101)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError when student is not linked to the parent', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.getEligibleTeachers(PAR, 101)).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // sendMessage
  describe('sendMessage', () => {
    function setupSend() {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      (prisma.student.findUnique as Mock).mockResolvedValue(STUDENT);
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue({ id: 1 }); // assignment exists
      (prisma.parentTeacherMessage.create as Mock).mockResolvedValue(mkMsg());
    }

    it('creates and returns a message DTO', async () => {
      setupSend();
      const r = await svc.sendMessage(PAR, { studentId: 101, recipientUserId: 4, body: 'Hello' });
      expect(r.id).toBe(1);
      expect(r.senderName).toBe('Papa P');
      expect(r.recipientName).toBe('Tom T');
      expect(r.body).toBe('Hello teacher');
    });

    it('throws ForbiddenError for non-PARENT actor', async () => {
      await expect(
        svc.sendMessage(TCH, { studentId: 101, recipientUserId: 4, body: 'Hi' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError when recipient is not a teacher', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      (prisma.student.findUnique as Mock).mockResolvedValue(STUDENT);
      (prisma.teacher.findUnique as Mock).mockResolvedValue(null); // no teacher profile
      await expect(
        svc.sendMessage(PAR, { studentId: 101, recipientUserId: 99, body: 'Hi' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError when teacher is not assigned to student classroom', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      (prisma.student.findUnique as Mock).mockResolvedValue(STUDENT);
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findFirst as Mock).mockResolvedValue(null); // not assigned
      await expect(
        svc.sendMessage(PAR, { studentId: 101, recipientUserId: 4, body: 'Hi' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // replyToMessage
  describe('replyToMessage', () => {
    it('teacher (recipient) can reply to a parent message', async () => {
      const original = mkMsg(1, { senderUserId: 6, recipientUserId: 4 });
      (prisma.parentTeacherMessage.findUnique as Mock).mockResolvedValue(original);
      (prisma.parentTeacherMessage.create as Mock).mockResolvedValue(mkMsg(2, { senderUserId: 4, recipientUserId: 6 }));
      (prisma.parentTeacherMessage.update as Mock).mockResolvedValue({});

      const r = await svc.replyToMessage(TCH, 1, { body: 'Reply text' });
      expect(r.id).toBe(2);
      expect(prisma.parentTeacherMessage.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when original message does not exist', async () => {
      (prisma.parentTeacherMessage.findUnique as Mock).mockResolvedValue(null);
      await expect(svc.replyToMessage(TCH, 999, { body: 'Reply' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws ForbiddenError when actor is not a party to the conversation', async () => {
      const original = mkMsg(1, { senderUserId: 6, recipientUserId: 4 }); // neither is userId=99
      (prisma.parentTeacherMessage.findUnique as Mock).mockResolvedValue(original);
      // actor is a parent not involved in this thread
      const otherPar = { userId: 99, role: 'PARENT' as const, username: 'other' };
      await expect(svc.replyToMessage(otherPar, 1, { body: 'Reply' })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('marks original as read when recipient replies', async () => {
      const original = mkMsg(1, { recipientUserId: 4, isRead: false }); // teacher is recipient
      (prisma.parentTeacherMessage.findUnique as Mock).mockResolvedValue(original);
      (prisma.parentTeacherMessage.create as Mock).mockResolvedValue(mkMsg(2));
      (prisma.parentTeacherMessage.update as Mock).mockResolvedValue({});

      await svc.replyToMessage(TCH, 1, { body: 'Got it' });
      expect(prisma.parentTeacherMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRead: true } })
      );
    });
  });

  // listThreads
  describe('listThreads', () => {
    it('returns items and meta for PARENT', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findMany as Mock).mockResolvedValue([{ studentId: 101 }]);
      (prisma.parentTeacherMessage.findMany as Mock).mockResolvedValue([
        { ...mkMsg(), replies: [] },
      ]);
      (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(1);

      const r = await svc.listThreads(PAR, { page: 1, limit: 20 });
      expect(r.items).toHaveLength(1);
      expect(r.meta.totalItems).toBe(1);
    });

    it('returns items and meta for TEACHER', async () => {
      (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
      (prisma.teacherSubject.findMany as Mock).mockResolvedValue([{ classroomId: 1 }]);
      (prisma.student.findMany as Mock).mockResolvedValue([{ studentId: 101 }]);
      (prisma.parentTeacherMessage.findMany as Mock).mockResolvedValue([
        { ...mkMsg(), replies: [] },
      ]);
      (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(1);

      const r = await svc.listThreads(TCH, { page: 1, limit: 20 });
      expect(r.items).toHaveLength(1);
    });

    it('throws ForbiddenError for DIRECTOR role', async () => {
      await expect(svc.listThreads(DIR, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError for STUDENT role', async () => {
      await expect(svc.listThreads(STU_ACTOR, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // getThread
  describe('getThread', () => {
    it('returns thread messages for PARENT', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      (prisma.parentTeacherMessage.findMany as Mock).mockResolvedValue([mkMsg()]);
      (prisma.parentTeacherMessage.updateMany as Mock).mockResolvedValue({ count: 0 });

      const r = await svc.getThread(PAR, { studentId: 101, otherUserId: 4 });
      expect(r).toHaveLength(1);
      expect(r[0].body).toBe('Hello teacher');
    });

    it('marks unread messages as read for actor', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue({ studentId: 101, parentId: 10 });
      // Message addressed to parent (userId=6) and unread
      const unreadMsg = mkMsg(1, { recipientUserId: 6, isRead: false });
      (prisma.parentTeacherMessage.findMany as Mock).mockResolvedValue([unreadMsg]);
      (prisma.parentTeacherMessage.updateMany as Mock).mockResolvedValue({ count: 1 });

      await svc.getThread(PAR, { studentId: 101, otherUserId: 4 });
      expect(prisma.parentTeacherMessage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRead: true } })
      );
    });

    it('throws ForbiddenError for non-parent, non-teacher role', async () => {
      await expect(
        svc.getThread(DIR, { studentId: 101, otherUserId: 4 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('throws ForbiddenError when parent is not linked to the student', async () => {
      (prisma.parent.findUnique as Mock).mockResolvedValue(PARENT);
      (prisma.studentParentLink.findUnique as Mock).mockResolvedValue(null);
      await expect(
        svc.getThread(PAR, { studentId: 101, otherUserId: 4 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // getUnreadCount
  describe('getUnreadCount', () => {
    it('returns the unread message count for the actor', async () => {
      (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(5);
      const count = await svc.getUnreadCount(TCH);
      expect(count).toBe(5);
    });

    it('returns 0 when no unread messages', async () => {
      (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(0);
      const count = await svc.getUnreadCount(PAR);
      expect(count).toBe(0);
    });

    it('queries by recipientUserId and isRead=false', async () => {
      (prisma.parentTeacherMessage.count as Mock).mockResolvedValue(3);
      await svc.getUnreadCount(TCH);
      const where = (prisma.parentTeacherMessage.count as Mock).mock.calls[0][0].where;
      expect(where.recipientUserId).toBe(4); // TCH.userId
      expect(where.isRead).toBe(false);
    });
  });
});
