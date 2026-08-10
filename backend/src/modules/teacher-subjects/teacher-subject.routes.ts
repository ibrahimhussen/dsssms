import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { teacherSubjectController } from './teacher-subject.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  assignmentIdParamSchema,
} from './validation/teacher-subject.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

router.get('/me', authorize(RoleName.TEACHER), teacherSubjectController.getMyAssignments);

router.post('/', authorize(...MANAGE_ROLES), validate(createAssignmentSchema), teacherSubjectController.create);
router.get(
  '/',
  authorize(...MANAGE_ROLES),
  validate(listAssignmentsQuerySchema, 'query'),
  teacherSubjectController.list
);
router.delete(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(assignmentIdParamSchema, 'params'),
  teacherSubjectController.delete
);

export const teacherSubjectRoutes = router;
