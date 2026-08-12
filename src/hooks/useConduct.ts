import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { conductApi, type CreateConductInput, type UpdateConductInput } from '../lib/conduct-api';

export function useUpsertConduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConductInput) => conductApi.upsertConduct(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conduct'] });
    },
  });
}

export function useUpdateConduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateConductInput }) =>
      conductApi.updateConduct(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conduct'] });
    },
  });
}

export function useStudentConduct(studentId: number, classroomId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['conduct', 'student', studentId, classroomId, semester, academicYear],
    queryFn: () => conductApi.getStudentConduct(studentId, classroomId, semester, academicYear),
    enabled: !!studentId && !!classroomId && !!semester && !!academicYear,
  });
}

export function useClassroomConducts(classroomId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['conduct', 'classroom', classroomId, semester, academicYear],
    queryFn: () => conductApi.getClassroomConducts(classroomId, semester, academicYear),
    enabled: !!classroomId && !!semester && !!academicYear,
  });
}

export function useClassroomConductSummary(classroomId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['conduct', 'classroom', classroomId, semester, academicYear, 'summary'],
    queryFn: () => conductApi.getClassroomConductSummary(classroomId, semester, academicYear),
    enabled: !!classroomId && !!semester && !!academicYear,
  });
}

export function useDeleteConduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => conductApi.deleteConduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conduct'] });
    },
  });
}
