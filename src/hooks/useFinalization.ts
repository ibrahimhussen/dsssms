import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { finalizationApi, type SubmitForReviewInput, type ReviewSubjectInput, type FinalizeSubjectInput, type FinalizeClassroomInput, type CorrectFinalizationInput } from '../lib/finalization-api';

export function useSubmitForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitForReviewInput) => finalizationApi.submitForReview(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}

export function useReviewSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewSubjectInput) => finalizationApi.reviewSubject(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}

export function useFinalizeSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FinalizeSubjectInput) => finalizationApi.finalizeSubject(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}

export function useFinalizeClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FinalizeClassroomInput) => finalizationApi.finalizeClassroom(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}

export function useSubjectFinalization(teacherSubjectId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['finalization', 'subject', teacherSubjectId, semester, academicYear],
    queryFn: () => finalizationApi.getSubjectFinalization(teacherSubjectId, semester, academicYear),
    enabled: !!teacherSubjectId && !!semester && !!academicYear,
  });
}

export function useClassroomFinalization(classroomId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['finalization', 'classroom', classroomId, semester, academicYear],
    queryFn: () => finalizationApi.getClassroomFinalization(classroomId, semester, academicYear),
    enabled: !!classroomId && !!semester && !!academicYear,
  });
}

export function useClassroomSubjectFinalizations(classroomId: number, semester: string, academicYear: string) {
  return useQuery({
    queryKey: ['finalization', 'classroom', classroomId, semester, academicYear, 'subjects'],
    queryFn: () => finalizationApi.getClassroomSubjectFinalizations(classroomId, semester, academicYear),
    enabled: !!classroomId && !!semester && !!academicYear,
  });
}

export function useCorrectSubjectFinalization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CorrectFinalizationInput }) =>
      finalizationApi.correctSubjectFinalization(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}

export function useCorrectClassroomFinalization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CorrectFinalizationInput }) =>
      finalizationApi.correctClassroomFinalization(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['finalization'] });
    },
  });
}
