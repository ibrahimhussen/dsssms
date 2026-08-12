import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';

export interface AcademicRegisterQuery {
  classroomId?: number;
  grade?: string;
  section?: string;
  academicYear: string;
  semester: 'SEMESTER_1' | 'SEMESTER_2';
  gradeWide?: boolean;
  page?: number;
  limit?: number;
}

export interface AcademicRegisterStudent {
  studentId: number;
  studentName: string;
  sectionRank?: number;
  gradeRank?: number;
  total: number;
  average: number;
  academicStatus: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'PENDING';
  subjectResults: Array<{
    subjectName: string;
    finalResult: number | null;
  }>;
  conduct?: string;
}

export interface AcademicRegisterMetadata {
  classroomLabel: string;
  academicYear: string;
  semester: string;
  totalStudents: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  pendingCount: number;
  classAverage: number;
}

export interface AcademicRegisterResponse {
  metadata: AcademicRegisterMetadata;
  students: AcademicRegisterStudent[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GradeSummaryResponse {
  grade: string;
  academicYear: string;
  semester: string;
  totalStudents: number;
  passedCount: number;
  failedCount: number;
  incompleteCount: number;
  pendingCount: number;
  gradeAverage: number;
  sections: Array<{
    section: string;
    sectionAverage: number;
    studentCount: number;
  }>;
}

export const academicRegisterApi = {
  async getRegister(query: AcademicRegisterQuery): Promise<AcademicRegisterResponse> {
    const params = new URLSearchParams();
    if (query.classroomId) params.append('classroomId', query.classroomId.toString());
    if (query.grade) params.append('grade', query.grade);
    if (query.section) params.append('section', query.section);
    params.append('academicYear', query.academicYear);
    params.append('semester', query.semester);
    if (query.gradeWide !== undefined) params.append('gradeWide', query.gradeWide.toString());
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const response = await unwrap(apiClient.get<ApiResponse<AcademicRegisterResponse>>(`/academic-register?${params.toString()}`));
    return response;
  },

  async getGradeSummary(grade: string, academicYear: string, semester: string): Promise<GradeSummaryResponse> {
    const response = await unwrap(apiClient.get<ApiResponse<GradeSummaryResponse>>(`/academic-register/grade/${grade}/${academicYear}/${semester}`));
    return response;
  },

  async getHistoricalRegister(studentId: number, academicYear: string, semester: string): Promise<AcademicRegisterResponse> {
    const response = await unwrap(apiClient.get<ApiResponse<AcademicRegisterResponse>>(`/academic-register/historical/${studentId}/${academicYear}/${semester}`));
    return response;
  },

  async exportToExcel(query: AcademicRegisterQuery): Promise<Blob> {
    const params = new URLSearchParams();
    if (query.classroomId) params.append('classroomId', query.classroomId.toString());
    if (query.grade) params.append('grade', query.grade);
    if (query.section) params.append('section', query.section);
    params.append('academicYear', query.academicYear);
    params.append('semester', query.semester);
    if (query.gradeWide !== undefined) params.append('gradeWide', query.gradeWide.toString());
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const response = await apiClient.get(`/academic-register/export/excel?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async exportToCSV(query: AcademicRegisterQuery): Promise<Blob> {
    const params = new URLSearchParams();
    if (query.classroomId) params.append('classroomId', query.classroomId.toString());
    if (query.grade) params.append('grade', query.grade);
    if (query.section) params.append('section', query.section);
    params.append('academicYear', query.academicYear);
    params.append('semester', query.semester);
    if (query.gradeWide !== undefined) params.append('gradeWide', query.gradeWide.toString());
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    const response = await apiClient.get(`/academic-register/export/csv?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
