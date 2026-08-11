import type { RoleName, UserStatus } from './auth';
import type { PaginationParams } from './pagination';

export interface UserSummary {
  userId: number;
  username: string;
  email: string | null;
  role: RoleName;
  status: UserStatus;
  fullName: string;
  lastLoginAt: string | null;
  createdAt: string;
  teacherId: number | null;
}

export interface IssuedCredentials {
  username: string;
  temporaryPassword: string;
}

export interface CreateStaffResult {
  user: UserSummary;
  credentials: IssuedCredentials;
}

export interface CreateStaffInput {
  role: Exclude<RoleName, 'STUDENT' | 'PARENT'>;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  qualification?: string;
  specialization?: string;
}

export interface ListUsersParams extends PaginationParams {
  role?: RoleName;
  status?: UserStatus;
  search?: string;
}

/** A granular/temporary permission assigned to a user account */
export interface UserPermission {
  id: number;
  userId: number;
  permission: string;
  grantedAt: string;
  expiresAt: string | null;
}

/** Payload to grant a permission to a user */
export interface GrantPermissionInput {
  permission: string;
  expiresAt?: string; // ISO datetime string, optional — null means permanent
}
