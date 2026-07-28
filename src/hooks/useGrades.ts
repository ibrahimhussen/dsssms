import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesApi } from '../lib/grades-api';
import type { BulkRecordGradesInput, ClassroomGradesQuery, StudentGradesParams } from '../types/grade';

function isCompleteQuery(query: Partial<ClassroomGradesQuery>): query is ClassroomGradesQuery {
  return Boolean(query.classroomId && query.subjectId && query.semester && query.academicYear);
}

export function useClassroomGrades(query: Partial<ClassroomGradesQuery>) {
  return useQuery({
    queryKey: ['grades', 'classroom', query],
    queryFn: () => gradesApi.getClassroomGrades(query as ClassroomGradesQuery),
    enabled: isCompleteQuery(query),
  });
}

export function useRecordBulkGrades() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkRecordGradesInput) => gradesApi.recordBulk(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}

export function useMyGrades(params: StudentGradesParams = {}) {
  return useQuery({
    queryKey: ['grades', 'me', params],
    queryFn: () => gradesApi.getMyGrades(params),
    placeholderData: (previousData) => previousData,
  });
}

export function useStudentGrades(studentId: number | undefined, params: StudentGradesParams = {}) {
  return useQuery({
    queryKey: ['grades', 'student', studentId, params],
    queryFn: () => gradesApi.getStudentGrades(studentId!, params),
    enabled: Boolean(studentId),
    placeholderData: (previousData) => previousData,
  });
}
