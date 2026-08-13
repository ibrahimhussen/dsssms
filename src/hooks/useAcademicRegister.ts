import { useQuery } from '@tanstack/react-query';
import { academicRegisterApi } from '../lib/academic-register-api';
import type { AcademicRegisterQuery, GradeRegisterQuery } from '../types/academic-register';

export function useAcademicRegister(query: AcademicRegisterQuery | null) {
  return useQuery({
    queryKey: ['academic-register', query],
    queryFn: () => academicRegisterApi.getRegister(query!),
    enabled:
      query !== null &&
      query.classroomId > 0 &&
      Boolean(query.academicYear) &&
      Boolean(query.viewMode),
    staleTime: 30_000,
  });
}

export function useGradeRegister(query: GradeRegisterQuery | null) {
  return useQuery({
    queryKey: ['academic-register', 'grade', query],
    queryFn: () => academicRegisterApi.getGradeRegister(query!),
    enabled:
      query !== null &&
      Boolean(query.grade) &&
      Boolean(query.academicYear) &&
      Boolean(query.viewMode),
    staleTime: 30_000,
  });
}
