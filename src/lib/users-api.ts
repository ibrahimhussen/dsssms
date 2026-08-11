import { apiClient, unwrap, unwrapPaginated } from './api-client';
import { cleanParams } from './clean-params';
import type { ApiResponse } from '../types/api';
import type { CreateStaffInput, CreateStaffResult, ListUsersParams, UserSummary, UserPermission, GrantPermissionInput } from '../types/user';
import type { UserStatus } from '../types/auth';

export const usersApi = {
  list(params: ListUsersParams) {
    return unwrapPaginated(
      apiClient.get<ApiResponse<UserSummary[]>>('/users', { params: cleanParams(params) })
    );
  },

  getById(userId: number) {
    return unwrap(apiClient.get<ApiResponse<UserSummary>>(`/users/${userId}`));
  },

  createStaff(input: CreateStaffInput) {
    return unwrap(apiClient.post<ApiResponse<CreateStaffResult>>('/users/staff', input));
  },

  updateStatus(userId: number, status: UserStatus) {
    return unwrap(apiClient.patch<ApiResponse<UserSummary>>(`/users/${userId}/status`, { status }));
  },

  resetPassword(userId: number) {
    return unwrap(
      apiClient.post<ApiResponse<{ username: string; temporaryPassword: string }>>(`/users/${userId}/reset-password`)
    );
  },

  // Permission management
  getPermissions(userId: number) {
    return unwrap(apiClient.get<ApiResponse<UserPermission[]>>(`/users/${userId}/permissions`));
  },

  grantPermission(userId: number, input: GrantPermissionInput) {
    return unwrap(apiClient.post<ApiResponse<UserPermission>>(`/users/${userId}/permissions`, input));
  },

  revokePermission(userId: number, permissionId: number) {
    return unwrap(
      apiClient.delete<ApiResponse<null>>(`/users/${userId}/permissions/${permissionId}`)
    );
  },
};
