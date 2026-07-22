import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classroomsApi } from '../lib/classrooms-api';
import type { CreateClassroomInput, ListClassroomsParams } from '../types/classroom';

export function useClassroomOptions() {
  return useQuery({
    queryKey: ['classrooms', 'options'],
    queryFn: () => classroomsApi.list({ limit: 100 }),
    staleTime: 60_000,
  });
}

export function useClassrooms(params: ListClassroomsParams) {
  return useQuery({
    queryKey: ['classrooms', params],
    queryFn: () => classroomsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassroomInput) => classroomsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classroomId: number) => classroomsApi.delete(classroomId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classrooms'] });
    },
  });
}
