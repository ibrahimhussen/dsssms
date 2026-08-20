// String literal unions mirror the backend's Prisma enums exactly (the
// values Prisma serializes to JSON), so no runtime import is needed here —
// these are types only and are always imported with `import type`.

export type RoleName = 'ADMIN' | 'DIRECTOR' | 'VICE_DIRECTOR' | 'TEACHER' | 'STUDENT' | 'PARENT';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface AuthenticatedUser {
  userId:              number;
  username:            string;
  email:               string | null;
  role:                RoleName;
  status:              UserStatus;
  permissions:         string[];
  isTemporaryPassword: boolean;
  profilePicture:      string | null;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}
