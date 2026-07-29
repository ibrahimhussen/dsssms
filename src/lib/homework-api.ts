import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  CreateHomeworkInput,
  HomeworkSubmission,
  HomeworkTask,
  MarkMyHomeworkSubmissionInput,
  StudentHomeworkTask,
  TeacherHomeworkTask,
  UpdateHomeworkSubmissionStatusInput,
} from '../types/homework';

export const homeworkApi = {
  getMyHomeworkAsTeacher(params: { teacherSubjectId?: number } = {}) {
    return unwrap(apiClient.get<ApiResponse<TeacherHomeworkTask[]>>('/assignments/me', { params: cleanParams(params) }));
  },

  getMyHomeworkAsStudent() {
    return unwrap(apiClient.get<ApiResponse<StudentHomeworkTask[]>>('/assignments/me'));
  },

  create(input: CreateHomeworkInput) {
    return unwrap(apiClient.post<ApiResponse<HomeworkTask>>('/assignments', input));
  },

  getSubmissions(assignmentId: number) {
    return unwrap(apiClient.get<ApiResponse<HomeworkSubmission[]>>(`/assignments/${assignmentId}/submissions`));
  },

  updateSubmissionStatus(assignmentId: number, studentId: number, input: UpdateHomeworkSubmissionStatusInput) {
    return unwrap(
      apiClient.patch<ApiResponse<HomeworkSubmission>>(`/assignments/${assignmentId}/submissions/${studentId}`, input)
    );
  },

  markMySubmission(assignmentId: number, input: MarkMyHomeworkSubmissionInput) {
    return unwrap(apiClient.patch<ApiResponse<HomeworkSubmission>>(`/assignments/${assignmentId}/submission`, input));
  },

  delete(assignmentId: number) {
    return unwrap(apiClient.delete<ApiResponse<null>>(`/assignments/${assignmentId}`));
  },
};
