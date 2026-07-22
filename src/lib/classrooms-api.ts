import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { ClassroomSummary, CreateClassroomInput, ListClassroomsParams } from '../types/classroom';

export const classroomsApi = {
  list(params: ListClassroomsParams = {}) {
    return unwrapPaginated(apiClient.get<ApiResponse<ClassroomSummary[]>>('/classrooms', { params: cleanParams(params) }));
  },

  create(input: CreateClassroomInput) {
    return unwrap(apiClient.post<ApiResponse<ClassroomSummary>>('/classrooms', input));
  },

  delete(classroomId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/classrooms/${classroomId}`));
  },
};
