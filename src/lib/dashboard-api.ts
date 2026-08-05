import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AdminDashboard, DirectorDashboard, ViceDirectorDashboard } from '../types/dashboard';

export const dashboardApi = {
  getAdminDashboard() {
    return unwrap(apiClient.get<ApiResponse<AdminDashboard>>('/dashboard/admin'));
  },

  getDirectorDashboard() {
    return unwrap(apiClient.get<ApiResponse<DirectorDashboard>>('/dashboard/director'));
  },

  getViceDirectorDashboard() {
    return unwrap(apiClient.get<ApiResponse<ViceDirectorDashboard>>('/dashboard/vice-director'));
  },
};
