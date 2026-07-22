import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  BulkGradeResult,
  BulkRecordGradesInput,
  ClassroomGradesParams,
  GradeRecord,
  StudentGradesParams,
  UpdateGradeInput,
} from '../types/grade';

export const gradesApi = {
  recordBulk(input: BulkRecordGradesInput) {
    return unwrap(apiClient.post<ApiResponse<BulkGradeResult>>('/grades', input));
  },

  update(gradeId: number, input: UpdateGradeInput) {
    return unwrap(apiClient.patch<ApiResponse<GradeRecord>>(`/grades/${gradeId}`, input));
  },

  getClassroomGrades(params: ClassroomGradesParams) {
    return unwrap(apiClient.get<ApiResponse<GradeRecord[]>>('/grades', { params: cleanParams(params) }));
  },

  getStudentGrades(studentId: number, params: StudentGradesParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<GradeRecord[]>>(`/grades/student/${studentId}`, { params: cleanParams(params) })
    );
  },

  getMyGrades(params: StudentGradesParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<GradeRecord[]>>('/grades/me', { params: cleanParams(params) })
    );
  },
};
