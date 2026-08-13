import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  AcademicRegisterQuery,
  AcademicRegisterResponse,
  ExportRegisterQuery,
  GradeRegisterQuery,
  GradeRegisterSummary,
} from '../types/academic-register';

export const academicRegisterApi = {
  getRegister(query: AcademicRegisterQuery) {
    return unwrap(
      apiClient.get<ApiResponse<AcademicRegisterResponse>>('/academic-register', {
        params: cleanParams(query as Record<string, unknown>),
      })
    );
  },

  getGradeRegister(query: GradeRegisterQuery) {
    return unwrap(
      apiClient.get<ApiResponse<GradeRegisterSummary>>('/academic-register/grade', {
        params: cleanParams(query as Record<string, unknown>),
      })
    );
  },

  exportRegister(query: ExportRegisterQuery): Promise<Blob> {
    return apiClient
      .get('/academic-register/export', {
        params: cleanParams(query as Record<string, unknown>),
        responseType: 'blob',
      })
      .then((r) => r.data as Blob);
  },
};
