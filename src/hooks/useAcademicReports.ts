import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { academicReportsApi } from '../lib/academic-reports-api';
import type { GenerateClassroomReportsInput } from '../types/academic-report';

export function useGenerateClassroomReports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateClassroomReportsInput) => academicReportsApi.generateForClassroom(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['academic-reports'] });
    },
  });
}

export function useMyAcademicReports() {
  return useQuery({
    queryKey: ['academic-reports', 'me'],
    queryFn: () => academicReportsApi.getMyReports(),
  });
}

/** Full report-card history for a specific student (used by the parent dashboard). */
export function useStudentReportHistory(studentId: number | undefined) {
  return useQuery({
    queryKey: ['academic-reports', 'student', studentId, 'history'],
    queryFn: () => academicReportsApi.getStudentReportHistory(studentId!),
    enabled: studentId !== undefined,
  });
}

export function useMyTranscript() {
  return useQuery({
    queryKey: ['academic-reports', 'me', 'transcript'],
    queryFn: () => academicReportsApi.getMyTranscript(),
  });
}

/** A specific student's transcript (used by the parent dashboard and oversight/teacher views). */
export function useStudentTranscript(studentId: number | undefined) {
  return useQuery({
    queryKey: ['academic-reports', 'student', studentId, 'transcript'],
    queryFn: () => academicReportsApi.getStudentTranscript(studentId!),
    enabled: studentId !== undefined,
  });
}

export function useMyReportCard(semester: string | undefined, academicYear: string | undefined) {
  return useQuery({
    queryKey: ['academic-reports', 'me', 'report-card', semester, academicYear],
    queryFn: () => academicReportsApi.getMyReportCard(semester as import('../types/grade').Semester, academicYear!),
    enabled: Boolean(semester && academicYear),
  });
}

export function useStudentReportCard(
  studentId: number | undefined,
  semester: string | undefined,
  academicYear: string | undefined
) {
  return useQuery({
    queryKey: ['academic-reports', 'student', studentId, 'report-card', semester, academicYear],
    queryFn: () => academicReportsApi.getStudentReportCard(studentId!, semester as import('../types/grade').Semester, academicYear!),
    enabled: Boolean(studentId && semester && academicYear),
  });
}
