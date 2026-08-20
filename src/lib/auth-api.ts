import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AuthenticatedUser, LoginResponse } from '../types/auth';

export interface FullProfile {
  userId:              number;
  username:            string;
  email:               string | null;
  role:                string;
  status:              string;
  profilePicture:      string | null;
  isTemporaryPassword: boolean;
  lastLoginAt:         string | null;
  createdAt:           string;
  roleData:            Record<string, unknown> | null;
}

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

  getProfile(): Promise<FullProfile> {
    return unwrap(apiClient.get<ApiResponse<FullProfile>>('/auth/profile'));
  },

  updateProfile(input: { email?: string | null; profilePicture?: string | null }): Promise<AuthenticatedUser> {
    return unwrap(apiClient.patch<ApiResponse<AuthenticatedUser>>('/auth/profile', input));
  },

  changePassword(input: { currentPassword: string; newPassword: string; confirmNewPassword: string }): Promise<null> {
    return unwrap(apiClient.post<ApiResponse<null>>('/auth/change-password', input));
  },
};
