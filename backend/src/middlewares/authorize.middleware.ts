import { NextFunction, Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../core/errors/app-error';
import prisma from '../core/config/prisma';

/**
 * Restricts a route to the given set of roles. Must run after `authenticate`.
 */
export function authorize(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`Role '${req.user.role}' is not permitted to access this resource`);
    }
    next();
  };
}

/**
 * Restricts a route to the given set of roles.
 * If the user does not have an allowed role but `fallbackPermissions` are provided,
 * it checks the database for temporary user permissions.
 */
export function authorizeWithPermissions(allowedRoles: RoleName[], fallbackPermissions: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError();
      }

      // 1. Check primary role
      if (allowedRoles.includes(req.user.role)) {
        return next();
      }

      // 2. If no fallback permissions are specified, immediately forbid.
      if (fallbackPermissions.length === 0) {
        throw new ForbiddenError(`Role '${req.user.role}' is not permitted to access this resource`);
      }

      // 3. Check temporary permissions in DB
      const userPermissions = await prisma.userPermission.findMany({
        where: {
          userId: req.user.userId,
          permission: { in: fallbackPermissions },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (userPermissions.length > 0) {
        return next();
      }

      throw new ForbiddenError(`Role '${req.user.role}' is not permitted and lacks required temporary permissions`);
    } catch (error) {
      next(error);
    }
  };
}
