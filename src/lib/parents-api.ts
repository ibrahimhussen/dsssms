import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { ParentSummary } from '../types/parent';

export const parentsApi = {
  getMyProfile() {
    return unwrap(apiClient.get<ApiResponse<ParentSummary>>('/parents/me'));
  },
};
