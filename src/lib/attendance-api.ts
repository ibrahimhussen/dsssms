import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type {
  AttendanceHistoryParams,
  AttendanceRecord,
  AttendanceSummary,
  AttendanceSummaryParams,
  BulkMarkAttendanceInput,
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

  getClassroomAttendance(classroomId: number, attendanceDate: string) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance', { params: { classroomId, attendanceDate } })
    );
  },

  markBulk(input: BulkMarkAttendanceInput) {
    return unwrap(apiClient.post<ApiResponse<{ classroomId: number; attendanceDate: string; recordsSaved: number }>>('/attendance', input));
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
