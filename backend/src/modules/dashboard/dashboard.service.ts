import { AttendanceStatus, RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma-client';
import {
  AdminDashboardDto,
  AttendanceStatusBreakdownDto,
  AttendanceTrendPointDto,
  DirectorDashboardDto,
  GradePerformancePointDto,
  PassRatePointDto,
  SubjectPerformancePointDto,
  ViceDirectorDashboardDto,
} from './dto/dashboard.dto';

const STAFF_ROLES: RoleName[] = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];
const ATTENDANCE_TREND_DAYS = 7;
const PASS_THRESHOLD = 50;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

/** Every classroom that currently has at least one enrolled student. */
async function getClassroomsWithStudents() {
  return prisma.classroom.findMany({
    where: { students: { some: {} } },
    select: { classroomId: true, className: true, section: true },
  });
}

/**
 * School-wide daily attendance rate for the last `days` days (including
 * today), one point per calendar day even if no attendance was recorded
 * that day (rate reported as 0 with totalRecorded 0).
 */
async function computeAttendanceTrend(days: number = ATTENDANCE_TREND_DAYS): Promise<AttendanceTrendPointDto[]> {
  const since = daysAgo(days - 1);

  const records = await prisma.attendance.findMany({
    where: { attendanceDate: { gte: since } },
    select: { attendanceDate: true, status: true },
  });

  const byDate = new Map<string, { present: number; total: number }>();
  for (let i = 0; i < days; i++) {
    byDate.set(isoDate(daysAgo(days - 1 - i)), { present: 0, total: 0 });
  }

  for (const r of records) {
    const bucket = byDate.get(isoDate(r.attendanceDate));
    if (!bucket) continue;
    bucket.total += 1;
    if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE) bucket.present += 1;
  }

  return [...byDate.entries()].map(([date, { present, total }]) => ({
    date,
    presentPercentage: total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
    totalRecorded: total,
  }));
}

/**
 * Each subject's average score, expressed as the mean of every graded
 * component-entry's percentage of that component's max marks (across all
 * classrooms, semesters, and years graded so far). A lightweight,
 * whole-history view rather than a single "current term" — this app has no
 * single global "current term" concept to anchor on.
 */
async function computeSubjectPerformance(): Promise<SubjectPerformancePointDto[]> {
  const components = await prisma.gradeComponent.findMany({
    include: { entries: true, teacherSubject: { include: { subject: true } } },
  });

  const bySubject = new Map<number, { subjectName: string; sumPercentage: number; count: number }>();

  for (const component of components) {
    const maxMarks = Number(component.maxMarks);
    if (maxMarks <= 0 || component.entries.length === 0) continue;

    const { subjectId, subjectName } = component.teacherSubject.subject;
    const bucket = bySubject.get(subjectId) ?? { subjectName, sumPercentage: 0, count: 0 };

    for (const entry of component.entries) {
      bucket.sumPercentage += (Number(entry.score) / maxMarks) * 100;
      bucket.count += 1;
    }

    bySubject.set(subjectId, bucket);
  }

  return [...bySubject.entries()]
    .map(([subjectId, { subjectName, sumPercentage, count }]) => ({
      subjectId,
      subjectName,
      averageScore: Math.round((sumPercentage / count) * 10) / 10,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);
}

/**
 * Each student's most recently generated academic report, grouped by their
 * current classroom — the basis for both the per-grade performance chart
 * and the pass-rate chart (pass = latest average mark >= PASS_THRESHOLD).
 */
async function computeGradePerformanceAndPassRate(): Promise<{
  performanceByGrade: GradePerformancePointDto[];
  passRateAnalysis: PassRatePointDto[];
  overallAverageScore: number;
  latestByStudent: Map<number, { classroomId: number; averageMark: number }>;
}> {
  const reports = await prisma.academicReport.findMany({
    include: { student: { select: { classroomId: true } } },
    orderBy: { generatedDate: 'desc' },
  });

  const latestByStudent = new Map<number, { classroomId: number; averageMark: number }>();
  for (const report of reports) {
    if (!latestByStudent.has(report.studentId)) {
      latestByStudent.set(report.studentId, {
        classroomId: report.student.classroomId,
        averageMark: Number(report.averageMark),
      });
    }
  }

  const byClassroom = new Map<number, { sum: number; pass: number; count: number }>();
  let schoolSum = 0;
  for (const { classroomId, averageMark } of latestByStudent.values()) {
    const bucket = byClassroom.get(classroomId) ?? { sum: 0, pass: 0, count: 0 };
    bucket.sum += averageMark;
    bucket.count += 1;
    if (averageMark >= PASS_THRESHOLD) bucket.pass += 1;
    byClassroom.set(classroomId, bucket);
    schoolSum += averageMark;
  }

  const classroomIds = [...byClassroom.keys()];
  const classrooms = classroomIds.length
    ? await prisma.classroom.findMany({ where: { classroomId: { in: classroomIds } } })
    : [];
  const labelById = new Map<number, string>(classrooms.map((c) => [c.classroomId, `${c.className} ${c.section}`]));

  const performanceByGrade: GradePerformancePointDto[] = classroomIds
    .map((classroomId) => {
      const { sum, count } = byClassroom.get(classroomId)!;
      return {
        classroomId,
        classroomLabel: labelById.get(classroomId) ?? `Classroom ${classroomId}`,
        averageScore: Math.round((sum / count) * 10) / 10,
        studentCount: count,
      };
    })
    .sort((a, b) => b.averageScore - a.averageScore);

  const passRateAnalysis: PassRatePointDto[] = classroomIds
    .map((classroomId) => {
      const { pass, count } = byClassroom.get(classroomId)!;
      return {
        classroomId,
        classroomLabel: labelById.get(classroomId) ?? `Classroom ${classroomId}`,
        passRate: count === 0 ? 0 : Math.round((pass / count) * 1000) / 10,
        studentCount: count,
      };
    })
    .sort((a, b) => b.passRate - a.passRate);

  const overallAverageScore = latestByStudent.size === 0 ? 0 : Math.round((schoolSum / latestByStudent.size) * 10) / 10;

  return { performanceByGrade, passRateAnalysis, overallAverageScore, latestByStudent };
}

export class DashboardService {
  async getAdminDashboard(): Promise<AdminDashboardDto> {
    const [
      totalStudents,
      totalTeachers,
      totalParents,
      totalStaffAccounts,
      totalSubjects,
      totalClassrooms,
      activeUsersToday,
      recentStudentRows,
      recentTeacherRows,
      recentLoginRows,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.user.count({ where: { role: { roleName: { in: STAFF_ROLES } } } }),
      prisma.subject.count(),
      prisma.classroom.count(),
      prisma.user.count({ where: { lastLoginAt: { gte: startOfToday() } } }),
      prisma.student.findMany({
        orderBy: { enrolledAt: 'desc' },
        take: 5,
        select: { studentId: true, firstName: true, lastName: true, admissionNumber: true, enrolledAt: true },
      }),
      prisma.teacher.findMany({
        orderBy: { user: { createdAt: 'desc' } },
        take: 5,
        include: { user: { select: { createdAt: true } } },
      }),
      prisma.user.findMany({
        where: { lastLoginAt: { not: null } },
        orderBy: { lastLoginAt: 'desc' },
        take: 5,
        include: { role: true },
      }),
    ]);

    return {
      stats: {
        totalStudents,
        totalTeachers,
        totalParents,
        totalStaffAccounts,
        totalSubjects,
        totalClassrooms,
        activeUsersToday,
        systemStatus: 'Operational',
      },
      recentStudents: recentStudentRows.map((s) => ({
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        admissionNumber: s.admissionNumber,
        enrolledAt: s.enrolledAt.toISOString(),
      })),
      recentTeachers: recentTeacherRows.map((t) => ({
        teacherId: t.teacherId,
        firstName: t.firstName,
        lastName: t.lastName,
        createdAt: t.user.createdAt.toISOString(),
      })),
      recentLogins: recentLoginRows.map((u) => ({
        userId: u.userId,
        username: u.username,
        role: u.role.roleName,
        lastLoginAt: u.lastLoginAt!.toISOString(),
      })),
    };
  }

  async getDirectorDashboard(): Promise<DirectorDashboardDto> {
    const [totalStudents, totalTeachers, attendanceTrend, subjectPerformance, gradeStats, classroomsWithStudents] =
      await Promise.all([
        prisma.student.count(),
        prisma.teacher.count(),
        computeAttendanceTrend(),
        computeSubjectPerformance(),
        computeGradePerformanceAndPassRate(),
        getClassroomsWithStudents(),
      ]);

    const coveredClassroomIds = new Set([...gradeStats.latestByStudent.values()].map((v) => v.classroomId));
    const pendingAcademicReports = classroomsWithStudents.filter((c) => !coveredClassroomIds.has(c.classroomId)).length;

    const topPerformingGrade = gradeStats.performanceByGrade[0]
      ? {
          classroomLabel: gradeStats.performanceByGrade[0].classroomLabel,
          averageScore: gradeStats.performanceByGrade[0].averageScore,
        }
      : null;

    return {
      stats: {
        totalStudents,
        totalTeachers,
        attendanceRateToday: attendanceTrend[attendanceTrend.length - 1]?.presentPercentage ?? 0,
        overallAverageScore: gradeStats.overallAverageScore,
        topPerformingGrade,
        pendingAcademicReports,
      },
      charts: {
        performanceByGrade: gradeStats.performanceByGrade,
        attendanceTrend,
        subjectPerformance,
        passRateAnalysis: gradeStats.passRateAnalysis,
      },
    };
  }

  async getViceDirectorDashboard(): Promise<ViceDirectorDashboardDto> {
    const today = startOfToday();

    const [totalTeachers, totalClasses, todayGrouped, weeklyAttendance, classroomsWithStudents, classroomsWithAttendanceToday] =
      await Promise.all([
        prisma.teacher.count(),
        prisma.classroom.count(),
        prisma.attendance.groupBy({ by: ['status'], where: { attendanceDate: today }, _count: { _all: true } }),
        computeAttendanceTrend(),
        getClassroomsWithStudents(),
        prisma.attendance.findMany({
          where: { attendanceDate: today },
          select: { classroomId: true },
          distinct: ['classroomId'],
        }),
      ]);

    const countByStatus: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    };
    for (const g of todayGrouped) countByStatus[g.status] = g._count._all;

    const totalToday = countByStatus.PRESENT + countByStatus.ABSENT + countByStatus.LATE + countByStatus.EXCUSED;
    const attendancePercentageToday =
      totalToday === 0 ? 0 : Math.round(((countByStatus.PRESENT + countByStatus.LATE) / totalToday) * 1000) / 10;

    const classroomIdsWithAttendanceToday = new Set(classroomsWithAttendanceToday.map((c) => c.classroomId));
    const pendingAttendanceReports = classroomsWithStudents.filter(
      (c) => !classroomIdsWithAttendanceToday.has(c.classroomId)
    ).length;

    const dailyAttendance: AttendanceStatusBreakdownDto[] = [
      { status: 'PRESENT', count: countByStatus.PRESENT },
      { status: 'ABSENT', count: countByStatus.ABSENT },
      { status: 'LATE', count: countByStatus.LATE },
      { status: 'EXCUSED', count: countByStatus.EXCUSED },
    ];

    return {
      stats: {
        studentsPresentToday: countByStatus.PRESENT,
        studentsAbsentToday: countByStatus.ABSENT,
        totalTeachers,
        totalClasses,
        attendancePercentageToday,
        pendingAttendanceReports,
      },
      charts: { dailyAttendance, weeklyAttendance },
    };
  }
}

export const dashboardService = new DashboardService();
