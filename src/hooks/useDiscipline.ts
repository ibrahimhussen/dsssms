import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { disciplineApi } from '../lib/discipline-api';
import type { CreateDisciplineRecordInput, UpdateDisciplineRecordInput, DisciplineSeverity, DisciplineStatus } from '../lib/discipline-api';

export function useDisciplineRecords(params?: {
  studentId?: number;
  severity?: DisciplineSeverity;
  status?: DisciplineStatus;
  search?: string;
}) {
  return useQuery({
    queryKey: ['discipline-records', params],
    queryFn: () => disciplineApi.list(params),
  });
}

export function useCreateDisciplineRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDisciplineRecordInput) => disciplineApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipline-records'] });
    },
  });
}

export function useUpdateDisciplineRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateDisciplineRecordInput }) => disciplineApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discipline-records'] });
    },
  });
}
