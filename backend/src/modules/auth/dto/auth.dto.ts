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
