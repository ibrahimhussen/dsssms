import { apiClient, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { ClassroomSummary } from '../types/classroom';
import type { PaginationParams } from '../types/pagination';

export const classroomsApi = {
  list(params: PaginationParams & { academicYear?: string; search?: string } = {}) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<ClassroomSummary[]>>('/classrooms', { params: cleanParams(params) })
    );
  },
};
