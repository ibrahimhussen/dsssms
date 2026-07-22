import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '../lib/subjects-api';
import type { CreateSubjectInput, ListSubjectsParams } from '../types/subject';

export function useSubjectOptions() {
  return useQuery({
    queryKey: ['subjects', 'options'],
    queryFn: () => subjectsApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
}

export function useSubjects(params: ListSubjectsParams) {
  return useQuery({
    queryKey: ['subjects', params],
    queryFn: () => subjectsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSubjectInput) => subjectsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subjectId: number) => subjectsApi.delete(subjectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
  });
}
