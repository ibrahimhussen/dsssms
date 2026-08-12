import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promotionApi } from '../lib/promotion-api';
import type {
  BulkAssignClassroomInput,
  CorrectEntryInput,
  CreateBatchInput,
  ListBatchesParams,
  RejectBatchInput,
  UpdateEntryInput,
} from '../types/promotion';

// ── Query keys ────────────────────────────────────────────────────────────────

const BATCHES_KEY = 'promotion-batches';
const batchKey = (id: number) => [BATCHES_KEY, id] as const;

// ── Queries ───────────────────────────────────────────────────────────────────

export function usePromotionBatches(params: ListBatchesParams) {
  return useQuery({
    queryKey: [BATCHES_KEY, params],
    queryFn: () => promotionApi.listBatches(params),
    placeholderData: (prev) => prev,
  });
}

export function usePromotionBatch(batchId: number | null) {
  return useQuery({
    queryKey: batchKey(batchId!),
    queryFn: () => promotionApi.getBatch(batchId!),
    enabled: batchId !== null,
  });
}

export function useStudentEnrollmentHistory(studentId: number | null) {
  return useQuery({
    queryKey: ['enrollment-history', studentId],
    queryFn: () => promotionApi.getStudentEnrollmentHistory(studentId!),
    enabled: studentId !== null,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreatePromotionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => promotionApi.createBatch(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [BATCHES_KEY] });
    },
  });
}

export function useUpdatePromotionEntry(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: number; input: UpdateEntryInput }) =>
      promotionApi.updateEntry(batchId, entryId, input),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(batchId), data);
    },
  });
}

export function useBulkAssignClassroom(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkAssignClassroomInput) => promotionApi.bulkAssignClassroom(batchId, input),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(batchId), data);
    },
  });
}

export function useSubmitPromotionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) => promotionApi.submitBatch(batchId),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(data.id), data);
      void qc.invalidateQueries({ queryKey: [BATCHES_KEY] });
    },
  });
}

export function useApprovePromotionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (batchId: number) => promotionApi.approveBatch(batchId),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(data.id), data);
      void qc.invalidateQueries({ queryKey: [BATCHES_KEY] });
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useRejectPromotionBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, input }: { batchId: number; input: RejectBatchInput }) =>
      promotionApi.rejectBatch(batchId, input),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(data.id), data);
      void qc.invalidateQueries({ queryKey: [BATCHES_KEY] });
    },
  });
}

export function useCorrectPromotionEntry(batchId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId, input }: { entryId: number; input: CorrectEntryInput }) =>
      promotionApi.correctEntry(batchId, entryId, input),
    onSuccess: (data) => {
      qc.setQueryData(batchKey(batchId), data);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
