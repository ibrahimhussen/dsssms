import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AuthenticatedUser, LoginResponse } from '../types/auth';

export const authApi = {
  login(username: string, password: string): Promise<LoginResponse> {
    return unwrap(apiClient.post<ApiResponse<LoginResponse>>('/auth/login', { username, password }));
  },

  logout(refreshToken: string): Promise<null> {
    return unwrap(apiClient.post<ApiResponse<null>>('/auth/logout', { refreshToken }));
  },

  me(): Promise<AuthenticatedUser> {
    return unwrap(apiClient.get<ApiResponse<AuthenticatedUser>>('/auth/me'));
  },

  changePassword(input: { currentPassword: string; newPassword: string; confirmNewPassword: string }): Promise<null> {
    return unwrap(apiClient.post<ApiResponse<null>>('/auth/change-password', input));
  },
};
