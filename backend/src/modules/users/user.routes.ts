import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { userController } from './user.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createStaffSchema,
  listUsersQuerySchema,
  replaceOfficeSchema,
  userIdParamSchema,
  updateUserStatusSchema,
} from './validation/user.validation';
import { userPermissionController } from './user-permission.controller';
import { grantPermissionSchema, removePermissionParamSchema } from './validation/user-permission.validation';

const router = Router();

router.use(authenticate);

router.post('/staff', authorize(RoleName.ADMIN), validate(createStaffSchema), userController.createStaff);

/**
 * Atomically replaces the current active Director or Vice Director.
 * ADMIN only. Returns the outgoing user (now INACTIVE), incoming user, and one-time credentials.
 */
router.post(
  '/staff/replace-office',
  authorize(RoleName.ADMIN),
  validate(replaceOfficeSchema),
  userController.replaceOfficeHolder,
);

/**
 * Returns the current active Director and Vice Director (at most one each).
 * Accessible to ADMIN so the UI can show the current officeholders and block duplicates.
 */
router.get(
  '/office-holders',
  authorize(RoleName.ADMIN),
  userController.getOfficeHolders,
);

router.get('/', authorize(RoleName.ADMIN), validate(listUsersQuerySchema, 'query'), userController.list);

// Directors and Vice Directors need to list teachers for classroom and assignment management.
// This is a scoped read — it only returns users with the TEACHER role.
router.get(
  '/teachers',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR),
  userController.listTeachers
);

router.get('/:id', authorize(RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR), validate(userIdParamSchema, 'params'), userController.getById);

router.patch(
  '/:id/status',
  authorize(RoleName.ADMIN),
  validate(userIdParamSchema, 'params'),
  validate(updateUserStatusSchema),
  userController.updateStatus
);

router.post(
  '/:id/reset-password',
  authorize(RoleName.ADMIN),
  validate(userIdParamSchema, 'params'),
  userController.resetPassword
);

router.get(
  '/:id/permissions',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR),
  validate(userIdParamSchema, 'params'),
  userPermissionController.getPermissions
);

router.post(
  '/:id/permissions',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR),
  validate(userIdParamSchema, 'params'),
  validate(grantPermissionSchema),
  userPermissionController.grantPermission
);

router.delete(
  '/:id/permissions/:permissionId',
  authorize(RoleName.ADMIN, RoleName.DIRECTOR),
  validate(removePermissionParamSchema, 'params'),
  userPermissionController.revokePermission
);

export const userRoutes = router;
