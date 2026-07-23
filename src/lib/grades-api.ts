import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { BulkRecordGradesInput, ClassroomGradesQuery, GradeRecord } from '../types/grade';

export const gradesApi = {
  getClassroomGrades(query: ClassroomGradesQuery) {
    return unwrap(apiClient.get<ApiResponse<GradeRecord[]>>('/grades', { params: query }));
  },

  recordBulk(input: BulkRecordGradesInput) {
    return unwrap(
      apiClient.post<ApiResponse<{ classroomId: number; subjectId: number; recordsSaved: number }>>('/grades', input)
    );
  },
};
