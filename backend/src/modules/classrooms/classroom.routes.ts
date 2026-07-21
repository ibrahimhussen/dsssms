import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { classroomController } from './classroom.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createClassroomSchema,
  updateClassroomSchema,
  listClassroomsQuerySchema,
  classroomIdParamSchema,
} from './validation/classroom.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const READ_ROLES = [...MANAGE_ROLES, RoleName.TEACHER];

router.post('/', authorize(...MANAGE_ROLES), validate(createClassroomSchema), classroomController.create);
router.get('/', authorize(...READ_ROLES), validate(listClassroomsQuerySchema, 'query'), classroomController.list);
router.get('/:id', authorize(...READ_ROLES), validate(classroomIdParamSchema, 'params'), classroomController.getById);

router.patch(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(classroomIdParamSchema, 'params'),
  validate(updateClassroomSchema),
  classroomController.update
);

router.delete(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(classroomIdParamSchema, 'params'),
  classroomController.delete
);

export const classroomRoutes = router;
