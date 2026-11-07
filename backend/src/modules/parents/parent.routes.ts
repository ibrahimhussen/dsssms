import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { parentController } from './parent.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createParentSchema, listParentsQuerySchema, parentIdParamSchema, resetParentPasswordSchema } from './validation/parent.validation';

const router = Router();

router.use(authenticate);

const STAFF_ROLES = [RoleName.DIRECTOR];
const ADMIN_ONLY  = [RoleName.ADMIN];

router.get('/me', authorize(RoleName.PARENT), parentController.getMyProfile);

router.post('/', authorize(...STAFF_ROLES), validate(createParentSchema), parentController.create);
router.get('/', authorize(...STAFF_ROLES), validate(listParentsQuerySchema, 'query'), parentController.list);
router.get('/:id', authorize(...STAFF_ROLES), validate(parentIdParamSchema, 'params'), parentController.getById);

// Admin-only: reset a parent's password
router.post(
  '/:id/reset-password',
  authorize(...ADMIN_ONLY),
  validate(parentIdParamSchema, 'params'),
  validate(resetParentPasswordSchema),
  parentController.resetPassword
);

export const parentRoutes = router;
