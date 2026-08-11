import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import { triggerBlobDownload } from './download-file';
import type { ApiResponse } from '../types/api';
import type {
  AttendanceHistoryParams,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceSummaryParams,
  BulkMarkAttendanceInput,
  AttendanceStatus,
} from '../types/attendance';

export const attendanceApi = {
  getMySummary(params: AttendanceSummaryParams = {}) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceSummary>>('/attendance/me/summary', { params: cleanParams(params) })
    );
  },

  getMyHistory(params: AttendanceHistoryParams = {}) {
    return unwrapPaginated(apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance/me', { params: cleanParams(params) }));
  },

  getClassroomAttendance(classroomId: number, attendanceDate: string, period?: number) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance', { params: cleanParams({ classroomId, attendanceDate, period }) })
    );
  },

  async exportClassroomAttendance(params: { classroomId: number; from?: string; to?: string }): Promise<void> {
    const response = await apiClient.get<Blob>('/attendance/export', { params: cleanParams(params), responseType: 'blob' });
    triggerBlobDownload(response.data, 'attendance.xlsx');
  },

  markBulk(input: BulkMarkAttendanceInput) {
    return unwrap(apiClient.post<ApiResponse<{ classroomId: number; attendanceDate: string; period: number; recordsSaved: number }>>('/attendance', input));
  },

  update(attendanceId: number, input: { status?: AttendanceStatus; remarks?: string }) {
    return unwrap(apiClient.patch<ApiResponse<AttendanceRecord>>(`/attendance/${attendanceId}`, input));
  },

  getStudentSummary(studentId: number, params: AttendanceSummaryParams = {}) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceSummary>>(`/attendance/student/${studentId}/summary`, { params: cleanParams(params) })
    );
  },

  getStudentHistory(studentId: number, params: AttendanceHistoryParams = {}) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<AttendanceRecord[]>>(`/attendance/student/${studentId}`, { params: cleanParams(params) })
    );
  },
};
