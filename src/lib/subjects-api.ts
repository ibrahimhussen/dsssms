import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateSubjectInput, ListSubjectsParams, SubjectSummary } from '../types/subject';

export const subjectsApi = {
  list(params: ListSubjectsParams = {}) {
    return unwrapPaginated(apiClient.get<ApiResponse<SubjectSummary[]>>('/subjects', { params: cleanParams(params) }));
  },

  create(input: CreateSubjectInput) {
    return unwrap(apiClient.post<ApiResponse<SubjectSummary>>('/subjects', input));
  },

  delete(subjectId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/subjects/${subjectId}`));
  },
};
