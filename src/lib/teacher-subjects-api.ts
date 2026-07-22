import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateAssignmentInput, ListAssignmentsParams, TeacherSubjectAssignment } from '../types/teacher-subject';

export const teacherSubjectsApi = {
  list(params: ListAssignmentsParams = {}) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<TeacherSubjectAssignment[]>>('/teacher-subjects', { params: cleanParams(params) })
    );
  },

  create(input: CreateAssignmentInput) {
    return unwrap(apiClient.post<ApiResponse<TeacherSubjectAssignment>>('/teacher-subjects', input));
  },

  delete(id: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/teacher-subjects/${id}`));
  },

  getMyAssignments() {
    return unwrap(apiClient.get<ApiResponse<TeacherSubjectAssignment[]>>('/teacher-subjects/me'));
  },
};
