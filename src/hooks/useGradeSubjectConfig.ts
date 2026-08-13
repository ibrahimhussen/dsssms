import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradeSubjectConfigApi } from '../lib/grade-subject-config-api';
import type {
  CopyFromYearInput,
  UpsertGradeSubjectConfigInput,
} from '../types/grade-subject-config';

const CONFIG_KEY = 'grade-subject-config';

export function useConfiguredGrades() {
  return useQuery({
    queryKey: [CONFIG_KEY, 'configured-grades'],
    queryFn: () => gradeSubjectConfigApi.listConfiguredGrades(),
    staleTime: 30_000,
  });
}

export function useGradeSubjectConfig(className: string, academicYear: string) {
  return useQuery({
    queryKey: [CONFIG_KEY, className, academicYear],
    queryFn: () => gradeSubjectConfigApi.listForGrade(className, academicYear),
    enabled: Boolean(className) && Boolean(academicYear),
    staleTime: 30_000,
  });
}

export function useUpsertGradeSubjectConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertGradeSubjectConfigInput) =>
      gradeSubjectConfigApi.upsert(input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: [CONFIG_KEY, variables.className, variables.academicYear] });
      void qc.invalidateQueries({ queryKey: [CONFIG_KEY, 'configured-grades'] });
    },
  });
}

export function useRemoveGradeSubjectConfig(className: string, academicYear: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => gradeSubjectConfigApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONFIG_KEY, className, academicYear] });
      void qc.invalidateQueries({ queryKey: [CONFIG_KEY, 'configured-grades'] });
    },
  });
}

export function useCopyFromYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CopyFromYearInput) => gradeSubjectConfigApi.copyFromYear(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONFIG_KEY] });
    },
  });
}
