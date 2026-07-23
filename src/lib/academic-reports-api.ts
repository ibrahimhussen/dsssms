import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AcademicReport, GenerateClassroomReportsInput, GenerateReportsResult } from '../types/academic-report';
import type { Semester } from '../types/grade';

export const academicReportsApi = {
  generateForClassroom(input: GenerateClassroomReportsInput) {
    return unwrap(apiClient.post<ApiResponse<GenerateReportsResult>>('/academic-reports/generate', input));
  },

  getStudentReportHistory(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<AcademicReport[]>>(`/academic-reports/student/${studentId}/history`));
  },

  getStudentReport(studentId: number, semester: Semester, academicYear: string) {
    return unwrap(
      apiClient.get<ApiResponse<AcademicReport>>(`/academic-reports/student/${studentId}`, {
        params: { semester, academicYear },
      })
    );
  },

  getMyReports() {
    return unwrap(apiClient.get<ApiResponse<AcademicReport[]>>('/academic-reports/me'));
  },
};
