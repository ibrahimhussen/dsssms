import { apiClient, unwrap } from './api-client';
import type { ApiResponse } from '../types/api';
import type { AuthenticatedUser } from '../types/auth';

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

/** Shape returned by POST /auth/login (refresh token is now in httpOnly cookie). */
export interface LoginResult {
  accessToken: string;
  user:        AuthenticatedUser;
}

export const authApi = {
  login(username: string, password: string): Promise<LoginResult> {
    return unwrap(apiClient.post<ApiResponse<LoginResult>>('/auth/login', { username, password }));
  },

  /** Logout — no body needed; refresh cookie is sent automatically and revoked by the backend. */
  logout(): Promise<null> {
    return unwrap(apiClient.post<ApiResponse<null>>('/auth/logout', {}));
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
