import { apiClient, unwrap } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { AttendanceRecord, AttendanceSummary, BulkMarkAttendanceInput } from '../types/attendance';

export const attendanceApi = {
  getMySummary() {
    return unwrap(apiClient.get<ApiResponse<AttendanceSummary>>('/attendance/me/summary'));
  },

  getClassroomAttendance(classroomId: number, attendanceDate: string) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceRecord[]>>('/attendance', { params: { classroomId, attendanceDate } })
    );
  },

  markBulk(input: BulkMarkAttendanceInput) {
    return unwrap(apiClient.post<ApiResponse<{ classroomId: number; attendanceDate: string; recordsSaved: number }>>('/attendance', input));
  },

  getStudentSummary(studentId: number, params: { from?: string; to?: string } = {}) {
    return unwrap(
      apiClient.get<ApiResponse<AttendanceSummary>>(`/attendance/student/${studentId}/summary`, { params: cleanParams(params) })
    );
  },
};
