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
  /** Full name from the role-specific record. Null when not yet populated. */
  fullName:            string | null;
}

/** @deprecated Use LoginResult from auth-api.ts — refreshToken is now in httpOnly cookie. */
export interface LoginResponse {
  user:        AuthenticatedUser;
  accessToken: string;
}

export interface RefreshResponse {
  /** New access token. Refresh token rotation is handled via httpOnly cookie. */
  accessToken: string;
}
