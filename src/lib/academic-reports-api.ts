import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  AcademicReport,
  GenerateClassroomReportsInput,
  GenerateReportsResult,
  ReportPeriodParams,
} from '../types/academic-report';

export const academicReportsApi = {
  generateForClassroom(input: GenerateClassroomReportsInput) {
    return unwrap(apiClient.post<ApiResponse<GenerateReportsResult>>('/academic-reports/generate', input));
  },

  getStudentReport(studentId: number, params: ReportPeriodParams) {
    return unwrap(
      apiClient.get<ApiResponse<AcademicReport>>(`/academic-reports/student/${studentId}`, {
        params: cleanParams(params),
      })
    );
  },

  listStudentReports(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<AcademicReport[]>>(`/academic-reports/student/${studentId}/history`));
  },

  getMyReports() {
    return unwrap(apiClient.get<ApiResponse<AcademicReport[]>>('/academic-reports/me'));
  },
};
