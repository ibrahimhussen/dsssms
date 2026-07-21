import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { subjectController } from './subject.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createSubjectSchema,
  updateSubjectSchema,
  listSubjectsQuerySchema,
  subjectIdParamSchema,
} from './validation/subject.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const READ_ROLES = [...MANAGE_ROLES, RoleName.TEACHER];

router.post('/', authorize(...MANAGE_ROLES), validate(createSubjectSchema), subjectController.create);
router.get('/', authorize(...READ_ROLES), validate(listSubjectsQuerySchema, 'query'), subjectController.list);
router.get('/:id', authorize(...READ_ROLES), validate(subjectIdParamSchema, 'params'), subjectController.getById);

router.patch(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(subjectIdParamSchema, 'params'),
  validate(updateSubjectSchema),
  subjectController.update
);

router.delete('/:id', authorize(...MANAGE_ROLES), validate(subjectIdParamSchema, 'params'), subjectController.delete);

export const subjectRoutes = router;
