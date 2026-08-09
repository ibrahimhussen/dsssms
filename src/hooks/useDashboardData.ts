import { useQueries, useQuery } from '@tanstack/react-query';
import { teacherSubjectsApi } from '../lib/teacher-subjects-api';
import { attendanceApi } from '../lib/attendance-api';
import { gradesApi } from '../lib/grades-api';
import { parentsApi } from '../lib/parents-api';
import type { TeacherSubjectAssignment } from '../types/teacher-subject';
import type { Semester } from '../types/grade';
import type { AttendanceStatus } from '../types/attendance';

const SEMESTERS: Semester[] = ['SEMESTER_1', 'SEMESTER_2'];

export function useMyTeachingAssignments() {
  return useQuery({
    queryKey: ['teacher-subjects', 'me'],
    queryFn: () => teacherSubjectsApi.getMyAssignments(),
  });
}

export function useMyAttendanceSummary() {
  return useQuery({
    queryKey: ['attendance', 'me', 'summary'],
    queryFn: () => attendanceApi.getMySummary(),
  });
}

export function useMyParentProfile() {
  return useQuery({
    queryKey: ['parents', 'me'],
    queryFn: () => parentsApi.getMyProfile(),
  });
}

const ATTENDANCE_TREND_WEEKS = 6;

function weeksAgoIso(weeks: number): string {
  const d = new Date();
  d.setDate(d.getDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Groups a flat list of attendance records into weekly present-rate buckets, oldest first. */
function bucketAttendanceByWeek(
  records: { attendanceDate: string; status: AttendanceStatus }[],
  weeks: number = ATTENDANCE_TREND_WEEKS
) {
  const weekStarts: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - i * 7);
    weekStarts.push(start);
  }

  const buckets = weekStarts.map((start) => ({
    label: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    start,
    present: 0,
    total: 0,
  }));

  for (const r of records) {
    const recordDate = new Date(r.attendanceDate);
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (recordDate >= buckets[i].start) {
        buckets[i].total += 1;
        if (r.status === 'PRESENT' || r.status === 'LATE') buckets[i].present += 1;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    value: b.total === 0 ? 0 : Math.round((b.present / b.total) * 1000) / 10,
  }));
}

/** Weekly attendance rate trend for the logged-in student, over the last few weeks. */
export function useMyAttendanceTrend() {
  const query = useQuery({
    queryKey: ['attendance', 'me', 'trend'],
    queryFn: () => attendanceApi.getMyHistory({ from: weeksAgoIso(ATTENDANCE_TREND_WEEKS), limit: 100 }),
  });

  return { data: query.data ? bucketAttendanceByWeek(query.data.items) : undefined, isLoading: query.isLoading };
}

/** Attendance totals for a specific student (used by the parent dashboard). */
export function useChildAttendanceSummary(studentId: number | undefined) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId, 'summary'],
    queryFn: () => attendanceApi.getStudentSummary(studentId!),
    enabled: studentId !== undefined,
  });
}

/** Weekly attendance rate trend for a specific student (used by the parent dashboard). */
export function useChildAttendanceTrend(studentId: number | undefined) {
  const query = useQuery({
    queryKey: ['attendance', 'student', studentId, 'trend'],
    queryFn: () => attendanceApi.getStudentHistory(studentId!, { from: weeksAgoIso(ATTENDANCE_TREND_WEEKS), limit: 100 }),
    enabled: studentId !== undefined,
  });

  return { data: query.data ? bucketAttendanceByWeek(query.data.items) : undefined, isLoading: query.isLoading };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * For each given classroom, checks whether any attendance has been recorded
 * for today. Used to surface a "pending" count on the teacher dashboard —
 * classrooms the teacher hasn't taken attendance for yet today.
 */
export function useTodaysAttendanceStatus(classroomIds: number[]) {
  const today = todayIsoDate();

  const results = useQueries({
    queries: classroomIds.map((classroomId) => ({
      queryKey: ['attendance', 'classroom', classroomId, today],
      queryFn: () => attendanceApi.getClassroomAttendance(classroomId, today),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const pendingClassroomIds = classroomIds.filter((_, i) => (results[i].data?.length ?? 0) === 0);

  return { isLoading, pendingClassroomIds, pendingCount: pendingClassroomIds.length };
}

/**
 * Today's attendance status breakdown (present/absent/late/excused) across
 * every classroom the teacher takes attendance for. Reuses the same query
 * key shape as `useTodaysAttendanceStatus`, so the two hooks share a single
 * network request per classroom when both render on the dashboard.
 */
export function useTeacherAttendanceSummary(classroomIds: number[]) {
  const today = todayIsoDate();

  const results = useQueries({
    queries: classroomIds.map((classroomId) => ({
      queryKey: ['attendance', 'classroom', classroomId, today],
      queryFn: () => attendanceApi.getClassroomAttendance(classroomId, today),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  for (const r of results) {
    for (const record of r.data ?? []) {
      counts[record.status] += 1;
    }
  }

  return { isLoading, counts };
}

/**
 * Buckets every student's current subject total (score / max marks, as a
 * percentage) across all of the teacher's teaching assignments and both
 * semesters of each assignment's academic year, into 6 score ranges — the
 * data behind the teacher dashboard's grade distribution chart.
 */
export function useTeacherGradeDistribution(assignments: TeacherSubjectAssignment[] | undefined) {
  const queries = (assignments ?? []).flatMap((a) =>
    SEMESTERS.map((semester) => ({
      queryKey: ['grades', 'classroom-totals', a.id, semester, a.classroom.academicYear],
      queryFn: () => gradesApi.getClassroomTotals({ teacherSubjectId: a.id, semester, academicYear: a.classroom.academicYear }),
    }))
  );

  const results = useQueries({ queries });
  const isLoading = (assignments === undefined) || results.some((r) => r.isLoading);

  const buckets = [
    { label: '0-49', min: 0, max: 49 },
    { label: '50-59', min: 50, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80-89', min: 80, max: 89 },
    { label: '90-100', min: 90, max: 100 },
  ];
  const bucketCounts = buckets.map((b) => ({ ...b, count: 0 }));

  for (const r of results) {
    for (const student of r.data ?? []) {
      if (student.totalMaxMarks <= 0) continue;
      const percentage = (student.totalScore / student.totalMaxMarks) * 100;
      const bucket = bucketCounts.find((b) => percentage >= b.min && percentage <= b.max) ?? bucketCounts[0];
      bucket.count += 1;
    }
  }

  return { isLoading, buckets: bucketCounts.map((b) => ({ label: b.label, value: b.count })) };
}
