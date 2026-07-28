import { useQueries, useQuery } from '@tanstack/react-query';
import { teacherSubjectsApi } from '../lib/teacher-subjects-api';
import { attendanceApi } from '../lib/attendance-api';
import { parentsApi } from '../lib/parents-api';

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
