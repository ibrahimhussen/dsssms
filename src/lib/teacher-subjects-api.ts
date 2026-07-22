import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { TeacherSubjectAssignment } from '../types/teacher-subject';

export const teacherSubjectsApi = {
  getMyAssignments() {
    return unwrap(apiClient.get<ApiResponse<TeacherSubjectAssignment[]>>('/teacher-subjects/me'));
  },
};
