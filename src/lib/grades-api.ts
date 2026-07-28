import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { BulkRecordGradesInput, ClassroomGradesQuery, GradeRecord, StudentGradesParams } from '../types/grade';

export const gradesApi = {
  getClassroomGrades(query: ClassroomGradesQuery) {
    return unwrap(apiClient.get<ApiResponse<GradeRecord[]>>('/grades', { params: query }));
  },

  recordBulk(input: BulkRecordGradesInput) {
    return unwrap(
      apiClient.post<ApiResponse<{ classroomId: number; subjectId: number; recordsSaved: number }>>('/grades', input)
    );
  },

  getMyGrades(params: StudentGradesParams = {}) {
    return unwrapPaginated(apiClient.get<ApiResponse<GradeRecord[]>>('/grades/me', { params: cleanParams(params) }));
  },

  getStudentGrades(studentId: number, params: StudentGradesParams = {}) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<GradeRecord[]>>(`/grades/student/${studentId}`, { params: cleanParams(params) })
    );
  },
};
