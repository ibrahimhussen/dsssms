import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { homeworkApi } from '../lib/homework-api';
import type { CreateHomeworkInput, MarkMyHomeworkSubmissionInput, UpdateHomeworkSubmissionStatusInput } from '../types/homework';

export function useMyHomeworkAsTeacher(params: { teacherSubjectId?: number } = {}) {
  return useQuery({
    queryKey: ['homework', 'me', 'teacher', params],
    queryFn: () => homeworkApi.getMyHomeworkAsTeacher(params),
  });
}

export function useMyHomeworkAsStudent() {
  return useQuery({
    queryKey: ['homework', 'me', 'student'],
    queryFn: () => homeworkApi.getMyHomeworkAsStudent(),
  });
}

export function useHomeworkSubmissions(assignmentId: number | undefined) {
  return useQuery({
    queryKey: ['homework', assignmentId, 'submissions'],
    queryFn: () => homeworkApi.getSubmissions(assignmentId!),
    enabled: Boolean(assignmentId),
  });
}

export function useCreateHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHomeworkInput) => homeworkApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}

export function useUpdateHomeworkSubmissionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      studentId,
      input,
    }: {
      assignmentId: number;
      studentId: number;
      input: UpdateHomeworkSubmissionStatusInput;
    }) => homeworkApi.updateSubmissionStatus(assignmentId, studentId, input),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['homework', variables.assignmentId, 'submissions'] });
      void queryClient.invalidateQueries({ queryKey: ['homework', 'me', 'teacher'] });
    },
  });
}

export function useMarkMyHomeworkSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, input }: { assignmentId: number; input: MarkMyHomeworkSubmissionInput }) =>
      homeworkApi.markMySubmission(assignmentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework', 'me', 'student'] });
    },
  });
}

export function useDeleteHomework() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => homeworkApi.delete(assignmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['homework'] });
    },
  });
}
