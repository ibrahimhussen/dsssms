import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradesApi } from '../lib/grades-api';
import type {
  CreateGradeComponentInput,
  GradeComponentQuery,
  RecordComponentEntriesInput,
  StudentGradesParams,
} from '../types/grade';

function isCompleteQuery(query: Partial<GradeComponentQuery>): query is GradeComponentQuery {
  return Boolean(query.teacherSubjectId && query.semester && query.academicYear);
}

export function useGradeScheme(query: Partial<GradeComponentQuery>) {
  return useQuery({
    queryKey: ['grades', 'components', query],
    queryFn: () => gradesApi.listComponents(query as GradeComponentQuery),
    enabled: isCompleteQuery(query),
  });
}

export function useCreateGradeComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGradeComponentInput) => gradesApi.createComponent(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}

export function useDeleteGradeComponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gradeComponentId: number) => gradesApi.deleteComponent(gradeComponentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] });
    },
  });
}

export function useComponentRoster(gradeComponentId: number | undefined) {
  return useQuery({
    queryKey: ['grades', 'components', gradeComponentId, 'entries'],
    queryFn: () => gradesApi.getComponentRoster(gradeComponentId!),
    enabled: Boolean(gradeComponentId),
  });
}

export function useRecordComponentEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gradeComponentId, input }: { gradeComponentId: number; input: RecordComponentEntriesInput }) =>
      gradesApi.recordComponentEntries(gradeComponentId, input),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['grades', 'components', variables.gradeComponentId, 'entries'] });
      void queryClient.invalidateQueries({ queryKey: ['grades', 'classroom-totals'] });
    },
  });
}

export function useClassroomTotals(query: Partial<GradeComponentQuery>) {
  return useQuery({
    queryKey: ['grades', 'classroom-totals', query],
    queryFn: () => gradesApi.getClassroomTotals(query as GradeComponentQuery),
    enabled: isCompleteQuery(query),
  });
}

export function useMyGrades(params: StudentGradesParams = {}) {
  return useQuery({
    queryKey: ['grades', 'me', params],
    queryFn: () => gradesApi.getMyGrades(params),
  });
}

export function useStudentGrades(studentId: number | undefined, params: StudentGradesParams = {}) {
  return useQuery({
    queryKey: ['grades', 'student', studentId, params],
    queryFn: () => gradesApi.getStudentGrades(studentId!, params),
    enabled: Boolean(studentId),
  });
}
