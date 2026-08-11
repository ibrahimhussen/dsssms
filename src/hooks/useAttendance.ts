import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../lib/attendance-api';
import type { AttendanceHistoryParams, AttendanceSummaryParams, BulkMarkAttendanceInput } from '../types/attendance';

export function useClassroomAttendance(classroomId: number | undefined, attendanceDate: string | undefined, period?: number) {
  return useQuery({
    queryKey: ['attendance', 'classroom', classroomId, attendanceDate, period],
    queryFn: () => attendanceApi.getClassroomAttendance(classroomId!, attendanceDate!, period),
    enabled: Boolean(classroomId && attendanceDate),
  });
}

export function useMarkBulkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkMarkAttendanceInput) => attendanceApi.markBulk(input),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['attendance', 'classroom', variables.classroomId, variables.attendanceDate],
      });
    },
  });
}

export function useMyAttendanceHistory(params: AttendanceHistoryParams) {
  return useQuery({
    queryKey: ['attendance', 'me', 'history', params],
    queryFn: () => attendanceApi.getMyHistory(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useStudentAttendanceSummary(studentId: number | undefined, params: AttendanceSummaryParams = {}) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId, 'summary', params],
    queryFn: () => attendanceApi.getStudentSummary(studentId!, params),
    enabled: Boolean(studentId),
  });
}

export function useStudentAttendanceHistory(studentId: number | undefined, params: AttendanceHistoryParams = {}) {
  return useQuery({
    queryKey: ['attendance', 'student', studentId, 'history', params],
    queryFn: () => attendanceApi.getStudentHistory(studentId!, params),
    enabled: Boolean(studentId),
    placeholderData: (previousData) => previousData,
  });
}
