import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateParentInput, CreateParentResult, ListParentsParams, ParentSummary } from '../types/parent';

export const parentsApi = {
  list(params: ListParentsParams) {
    return unwrapPaginated(apiClient.get<ApiResponse<ParentSummary[]>>('/parents', { params: cleanParams(params) }));
  },

  create(input: CreateParentInput) {
    return unwrap(apiClient.post<ApiResponse<CreateParentResult>>('/parents', input));
  },

  getMyProfile() {
    return unwrap(apiClient.get<ApiResponse<ParentSummary>>('/parents/me'));
  },
};
