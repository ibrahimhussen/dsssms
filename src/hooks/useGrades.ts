import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesApi } from '../lib/grades-api';
import type { BulkRecordGradesInput, ClassroomGradesQuery } from '../types/grade';

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
