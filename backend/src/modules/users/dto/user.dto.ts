import { RoleName, UserStatus } from '@prisma/client';

export interface UserSummaryDto {
  userId: number;
  username: string;
  email: string | null;
  role: RoleName;
  status: UserStatus;
  fullName: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Present only when role is TEACHER — the id assignment/homeroom endpoints expect. */
  teacherId: number | null;
}

/**
 * Returned exactly once, immediately after an admin creates a staff account
 * or resets a password — carries the plaintext temporary credential so it
 * can be handed to the user. Never persisted or logged in plaintext.
 */
export interface CredentialIssuedDto {
  username: string;
  temporaryPassword: string;
}

export interface CreateStaffResultDto {
  user: UserSummaryDto;
  credentials: CredentialIssuedDto;
}
