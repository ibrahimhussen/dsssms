import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '../lib/students-api';
import type { CreateStudentInput, ListStudentsParams, TransferOutInput } from '../types/student';

const studentsQueryKey = (params: ListStudentsParams) => ['students', params] as const;

export function useStudents(params: ListStudentsParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: studentsQueryKey(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previousData) => previousData,
    enabled: options.enabled ?? true,
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

export function useBulkImportStudents() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (students: CreateStudentInput[]) => studentsApi.bulkImport(students),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useTransferOutStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, input }: { studentId: number; input: TransferOutInput }) =>
      studentsApi.transferOut(studentId, input),
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
