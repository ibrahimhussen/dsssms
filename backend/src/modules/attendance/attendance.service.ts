import { AttendanceStatus, Prisma, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors/app-error';
import { getPaginationParams, buildPaginationMeta, PaginationQuery } from '../../core/http/pagination';
import { teacherSubjectService } from '../teacher-subjects/teacher-subject.service';
import { assertCanAccessStudentRecords } from '../../core/authorization/student-access';
import { AuthenticatedUser } from '../../middlewares/authenticate.middleware';
import { notifyStudentParents } from '../notifications/notification.service';
import { NotificationCategory } from '@prisma/client';
import {
  BulkMarkAttendanceInput,
  ClassroomAttendanceQuery,
  ClassroomAttendanceRangeQuery,
  StudentAttendanceQuery,
  AttendanceSummaryQuery,
  UpdateAttendanceInput,
} from './validation/attendance.validation';
import { AttendanceRecordDto, AttendanceSummaryDto, BulkAttendanceResultDto } from './dto/attendance.dto';

const ATTENDANCE_INCLUDE = {
  student: true,
  teacher: true,
} satisfies Prisma.AttendanceInclude;

type AttendanceWithRelations = Prisma.AttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

function toAttendanceRecordDto(a: AttendanceWithRelations): AttendanceRecordDto {
  return {
    attendanceId: a.attendanceId,
    studentId: a.studentId,
    studentName: `${a.student.firstName} ${a.student.lastName}`,
    classroomId: a.classroomId,
    attendanceDate: a.attendanceDate,
    period: a.period,
    status: a.status,
    remarks: a.remarks,
    isLocked: a.isLocked,
    recordedBy: { teacherId: a.teacher.teacherId, firstName: a.teacher.firstName, lastName: a.teacher.lastName },
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function getTeacherIdForUser(userId: number): Promise<number> {
  const teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) throw new ForbiddenError('No teacher profile is associated with this account');
  return teacher.teacherId;
}

export class AttendanceService {
  /**
   * Records attendance for an entire classroom roster in one call —
   * the natural teacher workflow ("take attendance" once per class per
   * day). Existing records for the same student/date are overwritten
   * (upsert), which also serves as the same-day self-correction path.
   */
  async markBulkAttendance(actor: AuthenticatedUser, input: BulkMarkAttendanceInput): Promise<BulkAttendanceResultDto> {
    const teacherId = await getTeacherIdForUser(actor.userId);

    await teacherSubjectService.assertTeacherAssignedToClassroom({ teacherId, classroomId: input.classroomId });

    const studentIds = input.records.map((r) => r.studentId);
    const uniqueStudentIds = new Set(studentIds);
    if (uniqueStudentIds.size !== studentIds.length) {
      throw new BadRequestError('Duplicate studentId entries in the attendance batch');
    }

    const studentsInClassroom = await prisma.student.findMany({
      where: { classroomId: input.classroomId, studentId: { in: studentIds } },
      select: { studentId: true },
    });

    if (studentsInClassroom.length !== studentIds.length) {
      const found = new Set(studentsInClassroom.map((s) => s.studentId));
      const missing = studentIds.filter((id) => !found.has(id));
      throw new BadRequestError(`These students are not enrolled in classroom ${input.classroomId}: ${missing.join(', ')}`);
    }

    await prisma.$transaction(
      input.records.map((record) =>
        prisma.attendance.upsert({
          where: { studentId_attendanceDate_period: { studentId: record.studentId, attendanceDate: input.attendanceDate, period: input.period } },
          create: {
            studentId: record.studentId,
            teacherId,
            classroomId: input.classroomId,
            attendanceDate: input.attendanceDate,
            period: input.period,
            status: record.status,
            remarks: record.remarks,
          },
          update: {
            teacherId,
            status: record.status,
            remarks: record.remarks,
          },
        })
      )
    );

    // Notify parents of absent students (daily roll call only — period 0)
    if (input.period === 0) {
      void this.notifyAbsentStudentParents(input.records, actor.userId, input.attendanceDate);
    }

    return { classroomId: input.classroomId, attendanceDate: input.attendanceDate, period: input.period, recordsSaved: input.records.length };
  }

  private async notifyAbsentStudentParents(
    records: { studentId: number; status: AttendanceStatus }[],
    teacherUserId: number,
    attendanceDate: Date
  ): Promise<void> {
    const absentIds = records
      .filter((r) => r.status === AttendanceStatus.ABSENT)
      .map((r) => r.studentId);
    if (absentIds.length === 0) return;

    const dateStr = attendanceDate instanceof Date
      ? attendanceDate.toLocaleDateString()
      : String(attendanceDate);

    await Promise.all(
      absentIds.map((studentId) =>
        notifyStudentParents({
          studentId,
          senderUserId:    teacherUserId,
          category:        NotificationCategory.ATTENDANCE,
          title:           'Student absence recorded',
          message:         `Your child was marked absent on ${dateStr}. Please contact the school if this is unexpected.`,
          relatedEntity:   'Attendance',
          relatedEntityId: String(studentId),
          deduplicationKeySuffix: `absence:${studentId}:${dateStr}`,
        })
      )
    );
  }

  async updateAttendance(actor: AuthenticatedUser, attendanceId: number, input: UpdateAttendanceInput): Promise<AttendanceRecordDto> {
    const record = await prisma.attendance.findUnique({ where: { attendanceId }, include: ATTENDANCE_INCLUDE });
    if (!record) throw new NotFoundError('Attendance record');

    const isOversight = ([RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR] as string[]).includes(actor.role);

    if (record.isLocked && !isOversight) {
      throw new ForbiddenError('This attendance record is locked and can only be updated by an administrator');
    }

    if (!isOversight) {
      const teacherId = await getTeacherIdForUser(actor.userId);
      const isOwnRecord = record.teacherId === teacherId;
      const isToday = isSameCalendarDay(record.attendanceDate, new Date());

      if (!isOwnRecord) {
        throw new ForbiddenError('You may only correct attendance records you recorded yourself');
      }
      if (!isToday) {
        throw new ForbiddenError('Attendance can only be corrected on the day it was recorded. Contact an administrator for older corrections.');
      }
    }

    const updated = await prisma.attendance.update({
      where: { attendanceId },
      data: { ...(input.status && { status: input.status }), ...(input.remarks !== undefined && { remarks: input.remarks }) },
      include: ATTENDANCE_INCLUDE,
    });

    return toAttendanceRecordDto(updated);
  }

  async getClassroomAttendance(actor: AuthenticatedUser, query: ClassroomAttendanceQuery): Promise<AttendanceRecordDto[]> {
    const isOversight = ([RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR] as string[]).includes(actor.role);

    if (!isOversight) {
      if (actor.role !== RoleName.TEACHER) {
        throw new ForbiddenError();
      }
      const teacherId = await getTeacherIdForUser(actor.userId);
      await teacherSubjectService.assertTeacherAssignedToClassroom({ teacherId, classroomId: query.classroomId });
    }

    const records = await prisma.attendance.findMany({
      where: { classroomId: query.classroomId, attendanceDate: query.attendanceDate, period: query.period },
      include: ATTENDANCE_INCLUDE,
      orderBy: { student: { firstName: 'asc' } },
    });

    return records.map(toAttendanceRecordDto);
  }

  /** Every attendance record for a classroom across a date range — the basis for the Excel export, same access rules as `getClassroomAttendance`. */
  async exportClassroomAttendance(actor: AuthenticatedUser, query: ClassroomAttendanceRangeQuery): Promise<AttendanceRecordDto[]> {
    const isOversight = ([RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR] as string[]).includes(actor.role);

    if (!isOversight) {
      if (actor.role !== RoleName.TEACHER) {
        throw new ForbiddenError();
      }
      const teacherId = await getTeacherIdForUser(actor.userId);
      await teacherSubjectService.assertTeacherAssignedToClassroom({ teacherId, classroomId: query.classroomId });
    }

    const records = await prisma.attendance.findMany({
      where: {
        classroomId: query.classroomId,
        ...((query.from || query.to) && {
          attendanceDate: {
            ...(query.from && { gte: query.from }),
            ...(query.to && { lte: query.to }),
          },
        }),
      },
      include: ATTENDANCE_INCLUDE,
      orderBy: [{ attendanceDate: 'asc' }, { student: { firstName: 'asc' } }],
      take: 10000,
    });

    return records.map(toAttendanceRecordDto);
  }

  async getStudentAttendanceHistory(
    actor: AuthenticatedUser,
    studentId: number,
    query: StudentAttendanceQuery
  ): Promise<{ items: AttendanceRecordDto[]; meta: ReturnType<typeof buildPaginationMeta> }> {
    await assertCanAccessStudentRecords(actor, studentId);

    const { skip, take } = getPaginationParams(query as PaginationQuery);

    const where: Prisma.AttendanceWhereInput = {
      studentId,
      ...((query.from || query.to) && {
        attendanceDate: {
          ...(query.from && { gte: query.from }),
          ...(query.to && { lte: query.to }),
        },
      }),
    };

    const [items, totalItems] = await Promise.all([
      prisma.attendance.findMany({ where, include: ATTENDANCE_INCLUDE, skip, take, orderBy: { attendanceDate: 'desc' } }),
      prisma.attendance.count({ where }),
    ]);

    return {
      items: items.map(toAttendanceRecordDto),
      meta: buildPaginationMeta({ page: query.page, limit: query.limit, totalItems }),
    };
  }

  async getStudentAttendanceSummary(
    actor: AuthenticatedUser,
    studentId: number,
    query: AttendanceSummaryQuery
  ): Promise<AttendanceSummaryDto> {
    await assertCanAccessStudentRecords(actor, studentId);

    const where: Prisma.AttendanceWhereInput = {
      studentId,
      ...((query.from || query.to) && {
        attendanceDate: {
          ...(query.from && { gte: query.from }),
          ...(query.to && { lte: query.to }),
        },
      }),
    };

    const grouped = await prisma.attendance.groupBy({ by: ['status'], where, _count: { _all: true } });

    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const g of grouped) {
      if (g.status === AttendanceStatus.PRESENT) counts.present = g._count._all;
      if (g.status === AttendanceStatus.ABSENT) counts.absent = g._count._all;
      if (g.status === AttendanceStatus.LATE) counts.late = g._count._all;
      if (g.status === AttendanceStatus.EXCUSED) counts.excused = g._count._all;
    }

    const totalDaysRecorded = counts.present + counts.absent + counts.late + counts.excused;
    const presentPercentage = totalDaysRecorded === 0 ? 0 : Math.round(((counts.present + counts.late) / totalDaysRecorded) * 1000) / 10;

    return { studentId, totalDaysRecorded, ...counts, presentPercentage };
  }
}

export const attendanceService = new AttendanceService();
