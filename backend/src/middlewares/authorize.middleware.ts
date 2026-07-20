import { NextFunction, Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../core/errors/app-error';

/**
 * Restricts a route to the given set of roles. Must run after `authenticate`.
 *
 * Usage: router.get('/reports', authenticate, authorize('ADMIN', 'DIRECTOR'), handler)
 */
export function authorize(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // authenticate() should always run first; this guards against misordered middleware.
      throw new UnauthorizedError();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Role '${req.user.role}' is not permitted to access this resource`
      );
    }

    next();
  };
}
