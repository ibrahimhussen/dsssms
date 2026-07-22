import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../lib/students-api';
import type { CreateStudentInput, ListStudentsParams } from '../types/student';

const studentsQueryKey = (params: ListStudentsParams) => ['students', params] as const;

export function useStudents(params: ListStudentsParams) {
  return useQuery({
    queryKey: studentsQueryKey(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => studentsApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useMyStudentProfile() {
  return useQuery({
    queryKey: ['students', 'me'],
    queryFn: () => studentsApi.getMyProfile(),
  });
}
