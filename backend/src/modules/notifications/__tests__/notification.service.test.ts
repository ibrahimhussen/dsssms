/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.6 — Notification Service Tests
 *
 * Covers:
 *  A. createAutoNotification (exported helper)
 *  B. notifyStudentParents (exported helper)
 *  C. NotificationService.send
 *  D. NotificationService.sendToParents
 *  E. NotificationService.broadcast
 *  F. NotificationService.getMyNotifications
 *  G. NotificationService.getUnreadCount
 *  H. NotificationService.markAsRead
 *  I. NotificationService.markAllAsRead
 *  J. NotificationService.delete
 *  K. NotificationService.listAll
 *
 * DATABASE SAFETY: all Prisma calls mocked — no MySQL required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import {
  NotificationService,
  createAutoNotification,
  notifyStudentParents,
} from '../notification.service';
import { NotificationCategory, NotificationStatus } from '@prisma/client';

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    user:               { findUnique: vi.fn(), findMany: vi.fn() },
    teacher:            { findUnique: vi.fn(), findMany: vi.fn() },
    parent:             { findMany: vi.fn() },
    student:            { findUnique: vi.fn(), findMany: vi.fn() },
    studentParentLink:  { findMany: vi.fn() },
    notification:       {
      findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
      create: vi.fn(), createMany: vi.fn(), update: vi.fn(),
      updateMany: vi.fn(), delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../../config/env', () => ({
  env: { NODE_ENV: 'test' },
  isProduction: false,
  isDevelopment: false,
  isTest: true,
}));

vi.mock('../../../core/authorization/student-access', () => ({
  assertCanAccessStudentRecords: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../teacher-subjects/teacher-subject.service', () => ({
  teacherSubjectService: {
    assertTeacherAssignedToClassroom: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../core/audit/audit-recorder', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../core/logger/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { prisma } from '../../../database/prisma-client';
import { assertCanAccessStudentRecords } from '../../../core/authorization/student-access';
import { teacherSubjectService } from '../../teacher-subjects/teacher-subject.service';
import { recordAudit } from '../../../core/audit/audit-recorder';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTOR_DIR   = { userId: 1, role: 'DIRECTOR'      as const, username: 'dir' };
const ACTOR_ADMIN = { userId: 2, role: 'ADMIN'         as const, username: 'adm' };
const ACTOR_VD    = { userId: 3, role: 'VICE_DIRECTOR' as const, username: 'vd'  };
const ACTOR_TCH   = { userId: 4, role: 'TEACHER'       as const, username: 'tch' };
const ACTOR_STU   = { userId: 5, role: 'STUDENT'       as const, username: 'stu' };
const ACTOR_PAR   = { userId: 6, role: 'PARENT'        as const, username: 'par' };

const TEACHER = { teacherId: 100, userId: 4, firstName: 'Tom', lastName: 'T' };
const PARENT1 = { parentId: 10, userId: 200, firstName: 'Papa', lastName: 'P' };
const PARENT2 = { parentId: 11, userId: 201, firstName: 'Mama', lastName: 'M' };

function mkNotifRow(overrides: Partial<{
  notificationId: number;
  recipientUserId: number | null;
  senderUserId: number | null;
  status: NotificationStatus;
  category: NotificationCategory;
  studentId: number | null;
}> = {}) {
  return {
    notificationId:  overrides.notificationId  ?? 1,
    recipientUserId: overrides.recipientUserId  ?? 5,
    senderUserId:    overrides.senderUserId     ?? 1,
    studentId:       overrides.studentId        ?? null,
    title:           'Test Title',
    message:         'Test message',
    sentDate:        new Date('2026-09-10T10:00:00Z'),
    status:          overrides.status   ?? NotificationStatus.UNREAD,
    category:        overrides.category ?? NotificationCategory.ANNOUNCEMENT,
    relatedEntity:   null,
    relatedEntityId: null,
    deduplicationKey: null,
    senderUser: {
      userId: 1, username: 'dir',
      director: { firstName: 'Dave', lastName: 'D' },
      viceDirector: null, administrator: null, teacher: null,
    },
    student: null,
  };
}

// ── A. createAutoNotification ────────────────────────────────────────────────

describe('A. createAutoNotification', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a notification when no deduplication key given', async () => {
    (prisma.notification.create as Mock).mockResolvedValue({});
    await createAutoNotification({
      recipientUserId: 5,
      category: NotificationCategory.ACADEMIC,
      title: 'Grade Released',
      message: 'Your grade is ready.',
    });
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it('skips creation when deduplication key already exists', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue({ notificationId: 99 }); // exists
    await createAutoNotification({
      recipientUserId: 5,
      category: NotificationCategory.ACADEMIC,
      title: 'Grade Released',
      message: 'Your grade is ready.',
      deduplicationKey: 'grade:release:1',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates when deduplication key does not yet exist', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(null);
    (prisma.notification.create as Mock).mockResolvedValue({});
    await createAutoNotification({
      recipientUserId: 5,
      category: NotificationCategory.ACADEMIC,
      title: 'New',
      message: 'msg',
      deduplicationKey: 'unique:key:1',
    });
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it('swallows errors silently — does not throw', async () => {
    (prisma.notification.create as Mock).mockRejectedValue(new Error('DB error'));
    await expect(
      createAutoNotification({
        recipientUserId: 5,
        category: NotificationCategory.SYSTEM,
        title: 'Fail',
        message: 'will error',
      })
    ).resolves.not.toThrow();
  });
});

// ── B. notifyStudentParents ───────────────────────────────────────────────────

describe('B. notifyStudentParents', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sends a notification to each linked parent', async () => {
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([
      { parent: { parentId: 10, userId: 200 } },
      { parent: { parentId: 11, userId: 201 } },
    ]);
    (prisma.notification.findUnique as Mock).mockResolvedValue(null);
    (prisma.notification.create as Mock).mockResolvedValue({});

    await notifyStudentParents({
      studentId: 101,
      category: NotificationCategory.ATTENDANCE,
      title: 'Absent',
      message: 'Your child was absent.',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(2);
  });

  it('sends nothing when student has no linked parents', async () => {
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
    await notifyStudentParents({
      studentId: 101,
      category: NotificationCategory.ATTENDANCE,
      title: 'Absent',
      message: 'msg',
    });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('swallows errors silently', async () => {
    (prisma.studentParentLink.findMany as Mock).mockRejectedValue(new Error('DB'));
    await expect(
      notifyStudentParents({
        studentId: 101,
        category: NotificationCategory.SYSTEM,
        title: 'T',
        message: 'M',
      })
    ).resolves.not.toThrow();
  });
});

// ── C. NotificationService.send ──────────────────────────────────────────────

describe('C. NotificationService.send', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('creates and returns a notification DTO', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 5 });
    (prisma.notification.create as Mock).mockResolvedValue(mkNotifRow());

    const r = await svc.send(ACTOR_DIR, {
      recipientUserId: 5,
      category: NotificationCategory.ANNOUNCEMENT,
      title: 'Test Title',
      message: 'Test message',
    });

    expect(r.notificationId).toBe(1);
    expect(r.title).toBe('Test Title');
    expect(r.senderName).toBe('Dave D'); // from director profile
    expect(r.status).toBe(NotificationStatus.UNREAD);
  });

  it('throws NotFoundError when recipient user does not exist', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.send(ACTOR_DIR, { recipientUserId: 999, category: NotificationCategory.ANNOUNCEMENT, title: 'Hi', message: 'msg' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws NotFoundError when studentId provided but student does not exist', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 5 });
    (prisma.student.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.send(ACTOR_DIR, { recipientUserId: 5, studentId: 999, category: NotificationCategory.ANNOUNCEMENT, title: 'Hi', message: 'msg' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('senderName resolves to teacher name when sender is a teacher', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 5 });
    (prisma.notification.create as Mock).mockResolvedValue({
      ...mkNotifRow(),
      senderUser: {
        userId: 4, username: 'tch',
        director: null, viceDirector: null, administrator: null,
        teacher: { firstName: 'Tom', lastName: 'T' },
      },
    });

    const r = await svc.send(ACTOR_TCH, { recipientUserId: 5, category: NotificationCategory.ANNOUNCEMENT, title: 'Hi', message: 'msg' });
    expect(r.senderName).toBe('Tom T');
  });

  it('senderName is username when no profile rows found', async () => {
    (prisma.user.findUnique as Mock).mockResolvedValue({ userId: 5 });
    (prisma.notification.create as Mock).mockResolvedValue({
      ...mkNotifRow(),
      senderUser: {
        userId: 9, username: 'unknown_user',
        director: null, viceDirector: null, administrator: null, teacher: null,
      },
    });

    const r = await svc.send(ACTOR_DIR, { recipientUserId: 5, category: NotificationCategory.ANNOUNCEMENT, title: 'Hi', message: 'msg' });
    expect(r.senderName).toBe('unknown_user');
  });
});

// ── D. NotificationService.sendToParents ─────────────────────────────────────

describe('D. NotificationService.sendToParents', () => {
  let svc: NotificationService;
  beforeEach(() => {
    svc = new NotificationService();
    vi.clearAllMocks();
    (assertCanAccessStudentRecords as Mock).mockResolvedValue(undefined);
  });

  it('creates one notification per linked parent and returns count', async () => {
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([
      { parent: { userId: 200 } },
      { parent: { userId: 201 } },
    ]);
    (prisma.notification.createMany as Mock).mockResolvedValue({ count: 2 });

    const r = await svc.sendToParents(ACTOR_DIR, 101, { title: 'Update', message: 'msg' });
    expect(r.notificationsSent).toBe(2);
    expect(r.studentId).toBe(101);
    expect(prisma.notification.createMany).toHaveBeenCalledOnce();
  });

  it('throws NotFoundError when student has no parents', async () => {
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([]);
    await expect(
      svc.sendToParents(ACTOR_DIR, 101, { title: 'Hi', message: 'msg' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('calls assertCanAccessStudentRecords', async () => {
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([{ parent: { userId: 200 } }]);
    (prisma.notification.createMany as Mock).mockResolvedValue({ count: 1 });

    await svc.sendToParents(ACTOR_STU, 101, { title: 'Hi', message: 'msg' });
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR_STU, 101);
  });
});

// ── E. NotificationService.broadcast ─────────────────────────────────────────

describe('E. NotificationService.broadcast', () => {
  let svc: NotificationService;
  beforeEach(() => {
    svc = new NotificationService();
    vi.clearAllMocks();
    (teacherSubjectService.assertTeacherAssignedToClassroom as Mock).mockResolvedValue(undefined);
    (prisma.notification.create as Mock).mockResolvedValue({});
    (prisma.notification.createMany as Mock).mockResolvedValue({ count: 0 });
  });

  it('broadcasts to ALL_TEACHERS and returns correct count', async () => {
    (prisma.teacher.findMany as Mock).mockResolvedValue([{ userId: 10 }, { userId: 11 }]);
    (prisma.notification.createMany as Mock).mockResolvedValue({ count: 2 });

    const r = await svc.broadcast(ACTOR_DIR, {
      audience: 'ALL_TEACHERS', category: NotificationCategory.ANNOUNCEMENT, title: 'Meeting', message: 'msg',
    });
    expect(r.audience).toBe('ALL_TEACHERS');
    expect(r.notificationsSent).toBe(2);
  });

  it('broadcasts to ALL_PARENTS', async () => {
    (prisma.parent.findMany as Mock).mockResolvedValue([{ userId: 200 }, { userId: 201 }, { userId: 202 }]);
    const r = await svc.broadcast(ACTOR_ADMIN, {
      audience: 'ALL_PARENTS', category: NotificationCategory.ANNOUNCEMENT, title: 'Notice', message: 'msg',
    });
    expect(r.notificationsSent).toBe(3);
  });

  it('broadcasts to CLASSROOM_STUDENTS', async () => {
    (prisma.student.findMany as Mock).mockResolvedValue([{ userId: 50 }, { userId: 51 }]);
    const r = await svc.broadcast(ACTOR_DIR, {
      audience: 'CLASSROOM_STUDENTS', classroomId: 1, category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M',
    });
    expect(r.notificationsSent).toBe(2);
    expect(r.audience).toBe('CLASSROOM_STUDENTS');
  });

  it('broadcasts to CLASSROOM_PARENTS and deduplicates parents', async () => {
    // Two students share parent userId=200 — should appear once
    (prisma.studentParentLink.findMany as Mock).mockResolvedValue([
      { parent: { userId: 200 } },
      { parent: { userId: 200 } }, // duplicate
      { parent: { userId: 201 } },
    ]);
    const r = await svc.broadcast(ACTOR_DIR, {
      audience: 'CLASSROOM_PARENTS', classroomId: 1, category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M',
    });
    // Set de-duplication → 2 unique parents
    expect(r.notificationsSent).toBe(2);
  });

  it('throws BadRequestError when CLASSROOM_STUDENTS has no classroomId', async () => {
    await expect(
      svc.broadcast(ACTOR_DIR, {
        audience: 'CLASSROOM_STUDENTS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M', // no classroomId
      } as Parameters<typeof svc.broadcast>[1])
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('teacher can broadcast to CLASSROOM_STUDENTS for their own classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.student.findMany as Mock).mockResolvedValue([{ userId: 50 }]);
    await expect(
      svc.broadcast(ACTOR_TCH, {
        audience: 'CLASSROOM_STUDENTS', classroomId: 1, category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M',
      })
    ).resolves.not.toThrow();
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).toHaveBeenCalled();
  });

  it('teacher cannot broadcast to ALL_STUDENTS — throws ForbiddenError', async () => {
    await expect(
      svc.broadcast(ACTOR_TCH, { audience: 'ALL_STUDENTS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('STUDENT cannot broadcast — throws ForbiddenError', async () => {
    await expect(
      svc.broadcast(ACTOR_STU, { audience: 'ALL_STUDENTS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('calls recordAudit after successful broadcast', async () => {
    (prisma.teacher.findMany as Mock).mockResolvedValue([{ userId: 10 }]);
    await svc.broadcast(ACTOR_DIR, { audience: 'ALL_TEACHERS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M' });
    expect(recordAudit).toHaveBeenCalledOnce();
  });

  it('creates a broadcast-summary row with null recipientUserId', async () => {
    (prisma.teacher.findMany as Mock).mockResolvedValue([]);
    await svc.broadcast(ACTOR_DIR, { audience: 'ALL_TEACHERS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M' });
    const createCall = (prisma.notification.create as Mock).mock.calls[0][0];
    expect(createCall.data.recipientUserId).toBeNull();
  });

  it('notificationsSent is 0 when audience has no members', async () => {
    (prisma.teacher.findMany as Mock).mockResolvedValue([]);
    const r = await svc.broadcast(ACTOR_DIR, { audience: 'ALL_TEACHERS', category: NotificationCategory.ANNOUNCEMENT, title: 'T', message: 'M' });
    expect(r.notificationsSent).toBe(0);
  });
});

// ── F. NotificationService.getMyNotifications ─────────────────────────────────

describe('F. NotificationService.getMyNotifications', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('returns items, meta, and unreadCount', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([mkNotifRow()]);
    (prisma.notification.count as Mock)
      .mockResolvedValueOnce(1)   // totalItems
      .mockResolvedValueOnce(1);  // unreadCount

    const r = await svc.getMyNotifications(5, { page: 1, limit: 20 });
    expect(r.items).toHaveLength(1);
    expect(r.meta.totalItems).toBe(1);
    expect(r.unreadCount).toBe(1);
  });

  it('returns empty items when user has no notifications', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    const r = await svc.getMyNotifications(5, { page: 1, limit: 20 });
    expect(r.items).toHaveLength(0);
    expect(r.unreadCount).toBe(0);
  });

  it('notification DTO has all expected fields', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([mkNotifRow({ notificationId: 42 })]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    const r = await svc.getMyNotifications(5, { page: 1, limit: 20 });
    const n = r.items[0];
    expect(n.notificationId).toBe(42);
    expect(n.title).toBe('Test Title');
    expect(typeof n.sentDate).toBe('string');  // ISO string
    expect(n.senderName).toBe('Dave D');
  });

  it('findMany is called with recipientUserId = userId', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    await svc.getMyNotifications(42, { page: 1, limit: 10 });
    const call = (prisma.notification.findMany as Mock).mock.calls[0][0];
    expect(call.where.recipientUserId).toBe(42);
  });
});

// ── G. NotificationService.getUnreadCount ────────────────────────────────────

describe('G. NotificationService.getUnreadCount', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('returns the unread notification count for a user', async () => {
    (prisma.notification.count as Mock).mockResolvedValue(7);
    const count = await svc.getUnreadCount(5);
    expect(count).toBe(7);
  });

  it('returns 0 when user has no unread notifications', async () => {
    (prisma.notification.count as Mock).mockResolvedValue(0);
    const count = await svc.getUnreadCount(5);
    expect(count).toBe(0);
  });

  it('queries only UNREAD status for the given userId', async () => {
    (prisma.notification.count as Mock).mockResolvedValue(3);
    await svc.getUnreadCount(99);
    const where = (prisma.notification.count as Mock).mock.calls[0][0].where;
    expect(where.recipientUserId).toBe(99);
    expect(where.status).toBe(NotificationStatus.UNREAD);
  });
});

// ── H. NotificationService.markAsRead ────────────────────────────────────────

describe('H. NotificationService.markAsRead', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('marks notification as READ and returns updated DTO', async () => {
    const row = mkNotifRow({ notificationId: 1, recipientUserId: 5 });
    (prisma.notification.findUnique as Mock).mockResolvedValue(row);
    (prisma.notification.update as Mock).mockResolvedValue({
      ...row, status: NotificationStatus.READ,
    });

    const r = await svc.markAsRead(5, 1);
    expect(r.status).toBe(NotificationStatus.READ);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: NotificationStatus.READ } })
    );
  });

  it('throws NotFoundError when notification does not exist', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.markAsRead(5, 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ForbiddenError when notification belongs to a different user', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(
      mkNotifRow({ recipientUserId: 99 }) // belongs to user 99, not 5
    );
    await expect(svc.markAsRead(5, 1)).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── I. NotificationService.markAllAsRead ─────────────────────────────────────

describe('I. NotificationService.markAllAsRead', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('returns updatedCount matching the number of updated rows', async () => {
    (prisma.notification.updateMany as Mock).mockResolvedValue({ count: 5 });
    const r = await svc.markAllAsRead(5);
    expect(r.updatedCount).toBe(5);
  });

  it('returns updatedCount 0 when no unread notifications', async () => {
    (prisma.notification.updateMany as Mock).mockResolvedValue({ count: 0 });
    const r = await svc.markAllAsRead(5);
    expect(r.updatedCount).toBe(0);
  });

  it('calls updateMany with correct where clause', async () => {
    (prisma.notification.updateMany as Mock).mockResolvedValue({ count: 3 });
    await svc.markAllAsRead(42);
    const call = (prisma.notification.updateMany as Mock).mock.calls[0][0];
    expect(call.where.recipientUserId).toBe(42);
    expect(call.where.status).toBe(NotificationStatus.UNREAD);
    expect(call.data.status).toBe(NotificationStatus.READ);
  });
});

// ── J. NotificationService.delete ────────────────────────────────────────────

describe('J. NotificationService.delete', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('deletes an owned notification without error', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(
      mkNotifRow({ notificationId: 1, recipientUserId: 5 })
    );
    (prisma.notification.delete as Mock).mockResolvedValue(undefined);

    await expect(svc.delete(5, 1)).resolves.not.toThrow();
    expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { notificationId: 1 } });
  });

  it('throws NotFoundError when notification does not exist', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.delete(5, 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ForbiddenError when notification belongs to a different user', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(
      mkNotifRow({ recipientUserId: 99 })
    );
    await expect(svc.delete(5, 1)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('delete is NOT called when ownership check fails', async () => {
    (prisma.notification.findUnique as Mock).mockResolvedValue(
      mkNotifRow({ recipientUserId: 99 })
    );
    await expect(svc.delete(5, 1)).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.notification.delete).not.toHaveBeenCalled();
  });
});

// ── K. NotificationService.listAll ───────────────────────────────────────────

describe('K. NotificationService.listAll', () => {
  let svc: NotificationService;
  beforeEach(() => { svc = new NotificationService(); vi.clearAllMocks(); });

  it('returns items and meta', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([mkNotifRow()]);
    (prisma.notification.count as Mock).mockResolvedValue(1);

    const r = await svc.listAll({ page: 1, limit: 20 });
    expect(r.items).toHaveLength(1);
    expect(r.meta.totalItems).toBe(1);
  });

  it('returns empty when no notifications', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    const r = await svc.listAll({ page: 1, limit: 20 });
    expect(r.items).toHaveLength(0);
  });

  it('filters by broadcastSummaryOnly=true (recipientUserId IS NULL)', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    await svc.listAll({ page: 1, limit: 10, broadcastSummaryOnly: 'true' });
    const where = (prisma.notification.findMany as Mock).mock.calls[0][0].where;
    expect(where.recipientUserId).toBeNull();
  });

  it('filters by recipientUserId when provided', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    await svc.listAll({ page: 1, limit: 10, recipientUserId: 5 });
    const where = (prisma.notification.findMany as Mock).mock.calls[0][0].where;
    expect(where.recipientUserId).toBe(5);
  });

  it('filters by category when provided', async () => {
    (prisma.notification.findMany as Mock).mockResolvedValue([]);
    (prisma.notification.count as Mock).mockResolvedValue(0);
    await svc.listAll({ page: 1, limit: 10, category: NotificationCategory.ATTENDANCE });
    const where = (prisma.notification.findMany as Mock).mock.calls[0][0].where;
    expect(where.category).toBe(NotificationCategory.ATTENDANCE);
  });
});
