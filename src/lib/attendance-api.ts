import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AttendanceSummary } from '../types/attendance';

export const attendanceApi = {
  getMySummary() {
    return unwrap(apiClient.get<ApiResponse<AttendanceSummary>>('/attendance/me/summary'));
  },
};
