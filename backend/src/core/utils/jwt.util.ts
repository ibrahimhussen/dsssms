import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { RoleName } from '@prisma/client';

/** Shape of the data embedded in every access token issued by this system. */
export interface AccessTokenPayload {
  sub: number; // userId
  role: RoleName;
  username: string;
}

/** Refresh tokens intentionally carry the minimum data needed to identify the session. */
export interface RefreshTokenPayload {
  sub: number; // userId
  jti: string; // token id, matches RefreshToken.id in the database
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as unknown as RefreshTokenPayload;
}
