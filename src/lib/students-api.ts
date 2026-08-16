import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import { triggerBlobDownload } from './download-file';
import type { ApiResponse } from '../types/api';
import type {
  CreateStudentInput,
  CreateStudentResult,
  ListStudentsParams,
  StudentSummary,
  StudentEnrollmentRecord,
  TransferOutInput,
  BulkImportResult,
} from '../types/student';

export const studentsApi = {
  list(params: ListStudentsParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<StudentSummary[]>>('/students', { params: cleanParams(params) })
    );
  },

  async exportToExcel(params: Pick<ListStudentsParams, 'classroomId' | 'search'>): Promise<void> {
    const response = await apiClient.get<Blob>('/students/export', {
      params: cleanParams(params),
      responseType: 'blob',
    });
    triggerBlobDownload(response.data, 'students.xlsx');
  },

  getById(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<StudentSummary>>(`/students/${studentId}`));
  },

  getEnrollmentHistory(studentId: number) {
    return unwrap(apiClient.get<ApiResponse<StudentEnrollmentRecord[]>>(`/students/${studentId}/enrollments`));
  },

  getMyProfile() {
    return unwrap(apiClient.get<ApiResponse<StudentSummary>>('/students/me'));
  },

  create(input: CreateStudentInput) {
    return unwrap(apiClient.post<ApiResponse<CreateStudentResult>>('/students', input));
  },

  bulkImport(students: CreateStudentInput[]) {
    return unwrap(
      apiClient.post<ApiResponse<BulkImportResult>>('/students/bulk', { students })
    );
  },

  transferOut(studentId: number, input: TransferOutInput) {
    return unwrap(
      apiClient.post<ApiResponse<StudentSummary>>(`/students/${studentId}/transfer-out`, input)
    );
  },

  transferClassroom(studentId: number, classroomId: number) {
    return unwrap(apiClient.patch<ApiResponse<StudentSummary>>(`/students/${studentId}/classroom`, { classroomId }));
  },
};
