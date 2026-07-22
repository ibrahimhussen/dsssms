import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherSubjectsApi } from '../lib/teacher-subjects-api';
import type { CreateAssignmentInput, ListAssignmentsParams } from '../types/teacher-subject';

export function useAssignments(params: ListAssignmentsParams) {
  return useQuery({
    queryKey: ['teacher-subjects', params],
    queryFn: () => teacherSubjectsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => teacherSubjectsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => teacherSubjectsApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['teacher-subjects'] });
    },
  });
}
