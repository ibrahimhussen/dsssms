import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  BulkAssignClassroomInput,
  CorrectEntryInput,
  CreateBatchInput,
  CreateBatchResult,
  ListBatchesParams,
  PromotionBatchDetail,
  PromotionBatchSummary,
  RejectBatchInput,
  StudentEnrollmentRecord,
  UpdateEntryInput,
} from '../types/promotion';

export const promotionApi = {
  // ── Batches ──────────────────────────────────────────────────────────────────

  createBatch(input: CreateBatchInput) {
    return unwrap(apiClient.post<ApiResponse<CreateBatchResult>>('/promotion', input));
  },

  listBatches(params: ListBatchesParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<PromotionBatchSummary[]>>('/promotion', { params: cleanParams(params) })
    );
  },

  getBatch(batchId: number) {
    return unwrap(apiClient.get<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}`));
  },

  // ── Entry editing ─────────────────────────────────────────────────────────────

  updateEntry(batchId: number, entryId: number, input: UpdateEntryInput) {
    return unwrap(
      apiClient.patch<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}/entries/${entryId}`, input)
    );
  },

  bulkAssignClassroom(batchId: number, input: BulkAssignClassroomInput) {
    return unwrap(
      apiClient.post<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}/bulk-assign`, input)
    );
  },

  // ── State transitions ─────────────────────────────────────────────────────────

  submitBatch(batchId: number) {
    return unwrap(apiClient.post<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}/submit`));
  },

  approveBatch(batchId: number) {
    return unwrap(apiClient.post<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}/approve`));
  },

  rejectBatch(batchId: number, input: RejectBatchInput) {
    return unwrap(apiClient.post<ApiResponse<PromotionBatchDetail>>(`/promotion/${batchId}/reject`, input));
  },

  // ── Corrections ───────────────────────────────────────────────────────────────

  correctEntry(batchId: number, entryId: number, input: CorrectEntryInput) {
    return unwrap(
      apiClient.post<ApiResponse<PromotionBatchDetail>>(
        `/promotion/${batchId}/entries/${entryId}/correct`,
        input
      )
    );
  },

  // ── Enrollment history ────────────────────────────────────────────────────────

  getStudentEnrollmentHistory(studentId: number) {
    return unwrap(
      apiClient.get<ApiResponse<StudentEnrollmentRecord[]>>(`/promotion/students/${studentId}/history`)
    );
  },
};
