import { NextFunction, Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { UnauthorizedError } from '../core/errors/app-error';
import { verifyAccessToken } from '../core/utils/jwt.util';

export interface AuthenticatedUser {
  userId: number;
  role: RoleName;
  username: string;
}

// Augment Express's Request type so `req.user` is available and typed
// everywhere downstream without repeated casting.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

/**
 * Verifies the caller's access token and attaches `req.user`. Every
 * protected route in the system depends on this running first.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.sub, role: payload.role, username: payload.username };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}