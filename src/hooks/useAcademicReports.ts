import { useMutation, useQueryClient } from '@tanstack/react-query';
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
