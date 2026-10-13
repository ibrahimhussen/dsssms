/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Phase 4.5 — Attendance Service Tests
 *
 * Covers all 7 AttendanceService methods:
 *  1. markBulkAttendance
 *  2. updateAttendance
 *  3. getClassroomAttendance
 *  4. exportClassroomAttendance
 *  5. getStudentAttendanceHistory
 *  6. getStudentAttendanceSummary
 *  (+ private notifyAbsentStudentParents behaviour via markBulkAttendance)
 *
 * DATABASE SAFETY: all Prisma calls mocked — no MySQL required.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { AttendanceService } from '../attendance.service';
import { AttendanceStatus } from '@prisma/client';

// ── Mock all external dependencies ──────────────────────────────────────────

vi.mock('../../../database/prisma-client', () => ({
  prisma: {
    teacher:    { findUnique: vi.fn() },
    student:    { findMany: vi.fn() },
    attendance: {
      findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(),
      upsert: vi.fn(), update: vi.fn(), groupBy: vi.fn(),
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

vi.mock('../../teacher-subjects/teacher-subject.service', () => ({
  teacherSubjectService: {
    assertTeacherAssignedToClassroom: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../notifications/notification.service', () => ({
  notifyStudentParents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../core/authorization/student-access', () => ({
  assertCanAccessStudentRecords: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../database/prisma-client';
import { teacherSubjectService } from '../../teacher-subjects/teacher-subject.service';
import { notifyStudentParents } from '../../notifications/notification.service';
import { assertCanAccessStudentRecords } from '../../../core/authorization/student-access';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACTOR_TCH  = { userId: 10, role: 'TEACHER'       as const, username: 'tch' };
const ACTOR_DIR  = { userId: 1,  role: 'DIRECTOR'      as const, username: 'dir' };
const ACTOR_ADMIN = { userId: 2, role: 'ADMIN'         as const, username: 'adm' };
const ACTOR_VD   = { userId: 3,  role: 'VICE_DIRECTOR' as const, username: 'vd'  };
const ACTOR_STU  = { userId: 5,  role: 'STUDENT'       as const, username: 'stu' };
const ACTOR_PAR  = { userId: 6,  role: 'PARENT'        as const, username: 'par' };

const TEACHER = { teacherId: 100, userId: 10, firstName: 'Tom', lastName: 'T' };

const STU1 = { studentId: 101, classroomId: 1, firstName: 'Alice', lastName: 'A' };
const STU2 = { studentId: 102, classroomId: 1, firstName: 'Bob',   lastName: 'B' };

const ATT_DATE = new Date('2026-09-10T00:00:00.000Z');

/** Builds a minimal attendance DB row with student + teacher relations */
function mkAttRow(overrides: Partial<{
  attendanceId: number;
  studentId: number;
  status: AttendanceStatus;
  isLocked: boolean;
  teacherId: number;
  attendanceDate: Date;
}> = {}) {
  const {
    attendanceId = 1, studentId = 101, status = AttendanceStatus.PRESENT,
    isLocked = false, teacherId = 100, attendanceDate = ATT_DATE,
  } = overrides;
  return {
    attendanceId, studentId, classroomId: 1, period: 0,
    status, remarks: null, isLocked, attendanceDate,
    teacherId, createdAt: new Date(), updatedAt: new Date(),
    student: { studentId, firstName: 'Alice', lastName: 'A' },
    teacher: { teacherId, firstName: 'Tom', lastName: 'T' },
  };
}

// ── 1. markBulkAttendance ────────────────────────────────────────────────────

describe('1. markBulkAttendance', () => {
  let svc: AttendanceService;
  beforeEach(() => {
    svc = new AttendanceService();
    vi.clearAllMocks();
    (teacherSubjectService.assertTeacherAssignedToClassroom as Mock).mockResolvedValue(undefined);
  });

  const BASE_INPUT = {
    classroomId: 1,
    attendanceDate: ATT_DATE,
    period: 0,
    records: [
      { studentId: 101, status: AttendanceStatus.PRESENT, remarks: undefined },
      { studentId: 102, status: AttendanceStatus.ABSENT,  remarks: undefined },
    ],
  };

  function setupMark(students = [{ studentId: 101 }, { studentId: 102 }]) {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.student.findMany as Mock).mockResolvedValue(students);
    (prisma.$transaction as Mock).mockResolvedValue([]);
  }

  it('returns correct result DTO with recordsSaved count', async () => {
    setupMark();
    const r = await svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT);
    expect(r.classroomId).toBe(1);
    expect(r.recordsSaved).toBe(2);
    expect(r.period).toBe(0);
    expect(r.attendanceDate).toEqual(ATT_DATE);
  });

  it('calls $transaction once with one upsert per record', async () => {
    setupMark();
    await svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    const txArg = (prisma.$transaction as Mock).mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(2);
  });

  it('calls assertTeacherAssignedToClassroom to verify access', async () => {
    setupMark();
    await svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT);
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).toHaveBeenCalledWith({
      teacherId: TEACHER.teacherId,
      classroomId: 1,
    });
  });

  it('triggers parent notification path when period = 0 and a student is absent (fire-and-forget)', async () => {
    setupMark();
    // markBulkAttendance uses `void this.notifyAbsentStudentParents(...)` — fire-and-forget.
    // We verify the attendance transaction was committed; notification runs asynchronously.
    await svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT); // record[1] is ABSENT
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    // Allow micro-task queue to flush so the void promise can start
    await Promise.resolve();
    // notifyStudentParents should have been called for the absent student
    expect(notifyStudentParents).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 102 })
    );
  });

  it('does NOT notify parents when period != 0 (not daily roll call)', async () => {
    setupMark();
    const input = { ...BASE_INPUT, period: 2 };
    await svc.markBulkAttendance(ACTOR_TCH, input);
    // notifyStudentParents should NOT be called for non-zero period
    expect(notifyStudentParents).not.toHaveBeenCalled();
  });

  it('throws BadRequestError for duplicate studentIds in batch', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.student.findMany as Mock).mockResolvedValue([{ studentId: 101 }]);
    await expect(
      svc.markBulkAttendance(ACTOR_TCH, {
        ...BASE_INPUT,
        records: [
          { studentId: 101, status: AttendanceStatus.PRESENT, remarks: undefined },
          { studentId: 101, status: AttendanceStatus.ABSENT,  remarks: undefined },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws BadRequestError when a student is not enrolled in the classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    // Only STU1 found — studentId 999 not enrolled
    (prisma.student.findMany as Mock).mockResolvedValue([{ studentId: 101 }]);
    await expect(
      svc.markBulkAttendance(ACTOR_TCH, {
        ...BASE_INPUT,
        records: [
          { studentId: 101, status: AttendanceStatus.PRESENT, remarks: undefined },
          { studentId: 999, status: AttendanceStatus.ABSENT,  remarks: undefined },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ForbiddenError when teacher has no teacher profile', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(null);
    await expect(svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws ForbiddenError when teacher is not assigned to the classroom', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (teacherSubjectService.assertTeacherAssignedToClassroom as Mock).mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 })
    );
    await expect(svc.markBulkAttendance(ACTOR_TCH, BASE_INPUT)).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── 2. updateAttendance ──────────────────────────────────────────────────────

describe('2. updateAttendance', () => {
  let svc: AttendanceService;
  beforeEach(() => { svc = new AttendanceService(); vi.clearAllMocks(); });

  it('updates status and returns DTO', async () => {
    const updated = mkAttRow({ status: AttendanceStatus.LATE });
    (prisma.attendance.findUnique as Mock).mockResolvedValue(mkAttRow({ isLocked: false, teacherId: 100 }));
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.update as Mock).mockResolvedValue(updated);

    // Must be "today" — fake today by making the record's date equal to now
    const todayRecord = mkAttRow({ attendanceDate: new Date(), isLocked: false, teacherId: 100 });
    (prisma.attendance.findUnique as Mock).mockResolvedValue(todayRecord);

    const r = await svc.updateAttendance(ACTOR_TCH, 1, { status: AttendanceStatus.LATE });
    expect(prisma.attendance.update).toHaveBeenCalledOnce();
    expect(r.status).toBe(AttendanceStatus.LATE);
  });

  it('DIRECTOR can update a locked record', async () => {
    const locked = mkAttRow({ isLocked: true });
    (prisma.attendance.findUnique as Mock).mockResolvedValue(locked);
    (prisma.attendance.update as Mock).mockResolvedValue({ ...locked, status: AttendanceStatus.EXCUSED });

    await expect(
      svc.updateAttendance(ACTOR_DIR, 1, { status: AttendanceStatus.EXCUSED })
    ).resolves.not.toThrow();
    expect(prisma.attendance.update).toHaveBeenCalledOnce();
  });

  it('ADMIN can update a locked record', async () => {
    const locked = mkAttRow({ isLocked: true });
    (prisma.attendance.findUnique as Mock).mockResolvedValue(locked);
    (prisma.attendance.update as Mock).mockResolvedValue({ ...locked, status: AttendanceStatus.EXCUSED });

    await expect(
      svc.updateAttendance(ACTOR_ADMIN, 1, { status: AttendanceStatus.EXCUSED })
    ).resolves.not.toThrow();
  });

  it('teacher cannot update a locked record — throws ForbiddenError', async () => {
    (prisma.attendance.findUnique as Mock).mockResolvedValue(mkAttRow({ isLocked: true }));
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    await expect(
      svc.updateAttendance(ACTOR_TCH, 1, { status: AttendanceStatus.LATE })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('teacher cannot update a record they did not record — throws ForbiddenError', async () => {
    // Record was recorded by teacherId=999, not our teacher (100)
    (prisma.attendance.findUnique as Mock).mockResolvedValue(
      mkAttRow({ isLocked: false, teacherId: 999, attendanceDate: new Date() })
    );
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER); // teacherId=100
    await expect(
      svc.updateAttendance(ACTOR_TCH, 1, { status: AttendanceStatus.LATE })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('teacher cannot update a record from a past day — throws ForbiddenError', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    (prisma.attendance.findUnique as Mock).mockResolvedValue(
      mkAttRow({ isLocked: false, teacherId: 100, attendanceDate: yesterday })
    );
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    await expect(
      svc.updateAttendance(ACTOR_TCH, 1, { status: AttendanceStatus.LATE })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws NotFoundError when attendance record does not exist', async () => {
    (prisma.attendance.findUnique as Mock).mockResolvedValue(null);
    await expect(
      svc.updateAttendance(ACTOR_TCH, 999, { status: AttendanceStatus.LATE })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('update is called with only the provided fields', async () => {
    const todayRecord = mkAttRow({ attendanceDate: new Date(), isLocked: false, teacherId: 100 });
    (prisma.attendance.findUnique as Mock).mockResolvedValue(todayRecord);
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.update as Mock).mockResolvedValue(todayRecord);

    await svc.updateAttendance(ACTOR_TCH, 1, { remarks: 'Sick' });
    const updateCall = (prisma.attendance.update as Mock).mock.calls[0][0];
    expect(updateCall.data.remarks).toBe('Sick');
    expect(updateCall.data.status).toBeUndefined();
  });
});

// ── 3. getClassroomAttendance ────────────────────────────────────────────────

describe('3. getClassroomAttendance', () => {
  let svc: AttendanceService;
  beforeEach(() => {
    svc = new AttendanceService();
    vi.clearAllMocks();
    // Restore default: teacher IS assigned (cleared by clearAllMocks)
    (teacherSubjectService.assertTeacherAssignedToClassroom as Mock).mockResolvedValue(undefined);
  });

  const QUERY = { classroomId: 1, attendanceDate: ATT_DATE, period: 0 };

  function setupRecords(rows = [mkAttRow()]) {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.findMany as Mock).mockResolvedValue(rows);
  }

  it('returns mapped attendance DTOs', async () => {
    setupRecords([mkAttRow({ attendanceId: 1, status: AttendanceStatus.PRESENT })]);
    const r = await svc.getClassroomAttendance(ACTOR_TCH, QUERY);
    expect(r).toHaveLength(1);
    expect(r[0].attendanceId).toBe(1);
    expect(r[0].studentName).toBe('Alice A');
    expect(r[0].status).toBe(AttendanceStatus.PRESENT);
    expect(r[0].recordedBy.teacherId).toBe(100);
  });

  it('returns empty array when no records exist for that date/period', async () => {
    setupRecords([]);
    const r = await svc.getClassroomAttendance(ACTOR_TCH, QUERY);
    expect(r).toHaveLength(0);
  });

  it('DIRECTOR can view attendance without assignment check', async () => {
    (prisma.attendance.findMany as Mock).mockResolvedValue([mkAttRow()]);
    const r = await svc.getClassroomAttendance(ACTOR_DIR, QUERY);
    expect(r).toHaveLength(1);
    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).not.toHaveBeenCalled();
  });

  it('ADMIN can view attendance without assignment check', async () => {
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    await expect(svc.getClassroomAttendance(ACTOR_ADMIN, QUERY)).resolves.not.toThrow();
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).not.toHaveBeenCalled();
  });

  it('VICE_DIRECTOR can view attendance without assignment check', async () => {
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    await expect(svc.getClassroomAttendance(ACTOR_VD, QUERY)).resolves.not.toThrow();
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).not.toHaveBeenCalled();
  });

  it('STUDENT role throws ForbiddenError', async () => {
    await expect(svc.getClassroomAttendance(ACTOR_STU, QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('PARENT role throws ForbiddenError', async () => {
    await expect(svc.getClassroomAttendance(ACTOR_PAR, QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('teacher calls assertTeacherAssignedToClassroom', async () => {
    setupRecords([]);
    await svc.getClassroomAttendance(ACTOR_TCH, QUERY);
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).toHaveBeenCalledWith({
      teacherId: TEACHER.teacherId,
      classroomId: 1,
    });
  });
});

// ── 4. exportClassroomAttendance ─────────────────────────────────────────────

describe('4. exportClassroomAttendance', () => {
  let svc: AttendanceService;
  beforeEach(() => {
    svc = new AttendanceService();
    vi.clearAllMocks();
    (teacherSubjectService.assertTeacherAssignedToClassroom as Mock).mockResolvedValue(undefined);
  });

  const RANGE_QUERY = {
    classroomId: 1,
    from: new Date('2026-09-01'),
    to: new Date('2026-09-30'),
  };

  it('returns all records in date range as DTOs', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.findMany as Mock).mockResolvedValue([
      mkAttRow({ attendanceId: 1 }),
      mkAttRow({ attendanceId: 2, studentId: 102, status: AttendanceStatus.ABSENT }),
    ]);
    const r = await svc.exportClassroomAttendance(ACTOR_TCH, RANGE_QUERY);
    expect(r).toHaveLength(2);
  });

  it('DIRECTOR can export without assignment check', async () => {
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    await expect(svc.exportClassroomAttendance(ACTOR_DIR, RANGE_QUERY)).resolves.not.toThrow();
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).not.toHaveBeenCalled();
  });

  it('STUDENT role throws ForbiddenError', async () => {
    await expect(svc.exportClassroomAttendance(ACTOR_STU, RANGE_QUERY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('empty date range returns empty array', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    const r = await svc.exportClassroomAttendance(ACTOR_TCH, { classroomId: 1 });
    expect(r).toHaveLength(0);
  });

  it('teacher calls assertTeacherAssignedToClassroom for export', async () => {
    (prisma.teacher.findUnique as Mock).mockResolvedValue(TEACHER);
    (prisma.attendance.findMany as Mock).mockResolvedValue([]);
    await svc.exportClassroomAttendance(ACTOR_TCH, RANGE_QUERY);
    expect(teacherSubjectService.assertTeacherAssignedToClassroom).toHaveBeenCalledWith({
      teacherId: TEACHER.teacherId,
      classroomId: 1,
    });
  });
});

// ── 5. getStudentAttendanceHistory ────────────────────────────────────────────

describe('5. getStudentAttendanceHistory', () => {
  let svc: AttendanceService;
  beforeEach(() => { svc = new AttendanceService(); vi.clearAllMocks(); });

  const HIST_QUERY = { page: 1, limit: 20 };

  function setupHistory(items = [mkAttRow()], total = 1) {
    (prisma.attendance.findMany as Mock).mockResolvedValue(items);
    (prisma.attendance.count as Mock).mockResolvedValue(total);
  }

  it('returns items and pagination meta', async () => {
    setupHistory([mkAttRow({ attendanceId: 1 })], 1);
    const r = await svc.getStudentAttendanceHistory(ACTOR_STU, 101, HIST_QUERY);
    expect(r.items).toHaveLength(1);
    expect(r.meta.totalItems).toBe(1);
    expect(r.items[0].attendanceId).toBe(1);
  });

  it('returns empty items with totalItems=0 when no records', async () => {
    setupHistory([], 0);
    const r = await svc.getStudentAttendanceHistory(ACTOR_STU, 101, HIST_QUERY);
    expect(r.items).toHaveLength(0);
    expect(r.meta.totalItems).toBe(0);
  });

  it('calls assertCanAccessStudentRecords for access control', async () => {
    setupHistory();
    await svc.getStudentAttendanceHistory(ACTOR_STU, 101, HIST_QUERY);
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR_STU, 101);
  });

  it('pagination meta has correct page and limit', async () => {
    setupHistory([mkAttRow()], 50);
    const r = await svc.getStudentAttendanceHistory(ACTOR_DIR, 101, { page: 2, limit: 10 });
    expect(r.meta.page).toBe(2);
    expect(r.meta.limit).toBe(10);
    expect(r.meta.totalItems).toBe(50);
  });

  it('items are ordered by attendanceDate desc (verified by findMany call args)', async () => {
    setupHistory([]);
    await svc.getStudentAttendanceHistory(ACTOR_STU, 101, HIST_QUERY);
    const call = (prisma.attendance.findMany as Mock).mock.calls[0][0];
    expect(call.orderBy).toEqual({ attendanceDate: 'desc' });
  });
});

// ── 6. getStudentAttendanceSummary ────────────────────────────────────────────

describe('6. getStudentAttendanceSummary', () => {
  let svc: AttendanceService;
  beforeEach(() => { svc = new AttendanceService(); vi.clearAllMocks(); });

  function setupSummary(grouped: { status: AttendanceStatus; _count: { _all: number } }[]) {
    (prisma.attendance.groupBy as Mock).mockResolvedValue(grouped);
  }

  it('counts each status correctly', async () => {
    setupSummary([
      { status: AttendanceStatus.PRESENT, _count: { _all: 40 } },
      { status: AttendanceStatus.ABSENT,  _count: { _all: 5  } },
      { status: AttendanceStatus.LATE,    _count: { _all: 3  } },
      { status: AttendanceStatus.EXCUSED, _count: { _all: 2  } },
    ]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.present).toBe(40);
    expect(r.absent).toBe(5);
    expect(r.late).toBe(3);
    expect(r.excused).toBe(2);
    expect(r.totalDaysRecorded).toBe(50);
  });

  it('presentPercentage counts PRESENT + LATE as attended', async () => {
    // 40 present + 3 late = 43 attended / 50 total = 86.0%
    setupSummary([
      { status: AttendanceStatus.PRESENT, _count: { _all: 40 } },
      { status: AttendanceStatus.ABSENT,  _count: { _all: 5  } },
      { status: AttendanceStatus.LATE,    _count: { _all: 3  } },
      { status: AttendanceStatus.EXCUSED, _count: { _all: 2  } },
    ]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.presentPercentage).toBeCloseTo(86.0, 0);
  });

  it('presentPercentage is 0 when totalDaysRecorded is 0', async () => {
    setupSummary([]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.totalDaysRecorded).toBe(0);
    expect(r.presentPercentage).toBe(0);
  });

  it('presentPercentage is 100 when all days are PRESENT', async () => {
    setupSummary([{ status: AttendanceStatus.PRESENT, _count: { _all: 30 } }]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.presentPercentage).toBe(100);
  });

  it('missing status in groupBy defaults to 0', async () => {
    // Only PRESENT returned — absent/late/excused not in result
    setupSummary([{ status: AttendanceStatus.PRESENT, _count: { _all: 20 } }]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.absent).toBe(0);
    expect(r.late).toBe(0);
    expect(r.excused).toBe(0);
  });

  it('calls assertCanAccessStudentRecords for access control', async () => {
    setupSummary([]);
    await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(assertCanAccessStudentRecords).toHaveBeenCalledWith(ACTOR_STU, 101);
  });

  it('returns correct studentId in summary', async () => {
    setupSummary([]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.studentId).toBe(101);
  });

  it('presentPercentage exact boundary: 1 absent out of 10 = 90%', async () => {
    setupSummary([
      { status: AttendanceStatus.PRESENT, _count: { _all: 9 } },
      { status: AttendanceStatus.ABSENT,  _count: { _all: 1 } },
    ]);
    const r = await svc.getStudentAttendanceSummary(ACTOR_STU, 101, {});
    expect(r.presentPercentage).toBe(90);
  });
});
