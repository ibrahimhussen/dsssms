import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { userController } from './user.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createStaffSchema,
  listUsersQuerySchema,
  userIdParamSchema,
  updateUserStatusSchema,
} from './validation/user.validation';

const router = Router();

router.use(authenticate);



router.post('/staff', authorize(RoleName.ADMIN), validate(createStaffSchema), userController.createStaff);

router.get('/', authorize(RoleName.ADMIN), validate(listUsersQuerySchema, 'query'), userController.list);

router.get('/:id', authorize(RoleName.ADMIN), validate(userIdParamSchema, 'params'), userController.getById);

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

export const userRoutes = router;
