import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../lib/attendance-api';
import type { BulkMarkAttendanceInput } from '../types/attendance';

export function useClassroomAttendance(classroomId: number | undefined, attendanceDate: string | undefined) {
  return useQuery({
    queryKey: ['attendance', 'classroom', classroomId, attendanceDate],
    queryFn: () => attendanceApi.getClassroomAttendance(classroomId!, attendanceDate!),
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
