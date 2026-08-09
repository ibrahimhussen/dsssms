import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timetableApi } from '../lib/timetable-api';
import type { CreateTimetableEntryInput, ListTimetableParams } from '../types/timetable';
import type { Semester } from '../types/grade';

export function useMyTimetable(semester?: Semester) {
  return useQuery({
    queryKey: ['timetable', 'me', semester],
    queryFn: () => timetableApi.getMyTimetable(semester),
  });
}

export function useTimetable(params: ListTimetableParams) {
  return useQuery({
    queryKey: ['timetable', params],
    queryFn: () => timetableApi.list(params),
    enabled: Boolean(params.classroomId || params.teacherSubjectId),
  });
}

export function useCreateTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTimetableEntryInput) => timetableApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });
}

export function useDeleteTimetableEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (timetableEntryId: number) => timetableApi.delete(timetableEntryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });
}
