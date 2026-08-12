import { useQuery } from '@tanstack/react-query';
import { academicRegisterApi, type AcademicRegisterQuery } from '../lib/academic-register-api';

export function useAcademicRegister(query: AcademicRegisterQuery) {
  return useQuery({
    queryKey: ['academic-register', query],
    queryFn: () => academicRegisterApi.getRegister(query),
    enabled: !!query.academicYear && !!query.semester,
  });
}

export function useGradeSummary(grade: string, academicYear: string, semester: string) {
  return useQuery({
    queryKey: ['academic-register', 'grade-summary', grade, academicYear, semester],
    queryFn: () => academicRegisterApi.getGradeSummary(grade, academicYear, semester),
    enabled: !!grade && !!academicYear && !!semester,
  });
}

export function useHistoricalRegister(studentId: number, academicYear: string, semester: string) {
  return useQuery({
    queryKey: ['academic-register', 'historical', studentId, academicYear, semester],
    queryFn: () => academicRegisterApi.getHistoricalRegister(studentId, academicYear, semester),
    enabled: !!studentId && !!academicYear && !!semester,
  });
}
