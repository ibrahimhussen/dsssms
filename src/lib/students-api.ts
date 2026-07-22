import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateStudentInput, CreateStudentResult, ListStudentsParams, StudentSummary } from '../types/student';

export const studentsApi = {
  list(params: ListStudentsParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<StudentSummary[]>>('/students', { params: cleanParams(params) })
    );
  },

  getById(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<StudentSummary>>(`/students/${studentId}`));
  },

  getMyProfile() {
    return unwrap(apiClient.get<ApiResponse<StudentSummary>>('/students/me'));
  },

  create(input: CreateStudentInput) {
    return unwrap(apiClient.post<ApiResponse<CreateStudentResult>>('/students', input));
  },

  transferClassroom(studentId: number, classroomId: number) {
    return unwrap(apiClient.patch<ApiResponse<StudentSummary>>(`/students/${studentId}/classroom`, { classroomId }));
  },
};
