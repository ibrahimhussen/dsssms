import { apiClient, unwrap } from './api-client';
import { triggerBlobDownload } from './download-file';
import type { ApiResponse } from '../types/api';
import type {
  AcademicReport,
  GenerateClassroomReportsInput,
  GenerateReportsResult,
  Transcript,
} from '../types/academic-report';
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

  getMyTranscript() {
    return unwrap(apiClient.get<ApiResponse<Transcript>>('/academic-reports/me/transcript'));
  },

  getStudentTranscript(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<Transcript>>(`/academic-reports/student/${studentId}/transcript`));
  },

  async downloadTranscriptPdf(studentId: number, admissionNumber: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/academic-reports/student/${studentId}/transcript/pdf`, {
      responseType: 'blob',
    });
    triggerBlobDownload(response.data, `transcript-${admissionNumber}.pdf`);
  },

  async downloadReportCardPdf(studentId: number, semester: Semester, academicYear: string): Promise<void> {
    const response = await apiClient.get<Blob>(`/academic-reports/student/${studentId}/pdf`, {
      params: { semester, academicYear },
      responseType: 'blob',
    });
    triggerBlobDownload(response.data, `report-card-${academicYear.replace('/', '-')}-${semester}.pdf`);
  },
};
