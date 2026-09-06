import { RoleName } from '@prisma/client';

export interface AuthenticatedUserDto {
  userId: number;
  username: string;
  email: string | null;
  role: RoleName;
  status: string;
  permissions: string[];
  isTemporaryPassword: boolean;
  profilePicture: string | null;
  /** Full name from the role-specific record (e.g. Teacher.firstName + lastName). Null when not yet set. */
  fullName: string | null;
}

export interface LoginResponseDto {
  user: AuthenticatedUserDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}
