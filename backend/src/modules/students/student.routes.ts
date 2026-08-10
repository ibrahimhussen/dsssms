import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { studentController } from './student.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdParamSchema,
  updateStudentSchema,
  transferClassroomSchema,
  removeParentLinkParamSchema,
} from './validation/student.validation';
import { linkParentToStudentSchema } from '../parents/validation/parent.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const READ_ROLES = [...MANAGE_ROLES, RoleName.TEACHER];

// Student's own profile — must be declared before the generic '/:id' route.
router.get('/me', authorize(RoleName.STUDENT), studentController.getMyProfile);

router.post('/', authorize(...MANAGE_ROLES), validate(createStudentSchema), studentController.create);
router.get('/', authorize(...READ_ROLES), validate(listStudentsQuerySchema, 'query'), studentController.list);
router.get('/export', authorize(...READ_ROLES), validate(listStudentsQuerySchema, 'query'), studentController.export);
router.get('/:id', authorize(...READ_ROLES), validate(studentIdParamSchema, 'params'), studentController.getById);

router.patch(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(updateStudentSchema),
  studentController.update
);

router.patch(
  '/:id/classroom',
  authorize(...MANAGE_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(transferClassroomSchema),
  studentController.transferClassroom
);

router.post(
  '/:id/parents',
  authorize(...MANAGE_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(linkParentToStudentSchema),
  studentController.addParent
);

router.delete(
  '/:id/parents/:parentId',
  authorize(...MANAGE_ROLES),
  validate(removeParentLinkParamSchema, 'params'),
  studentController.removeParent
);

export const studentRoutes = router;
