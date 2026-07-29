import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { timetableController } from './timetable.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createTimetableEntrySchema, listTimetableQuerySchema, timetableEntryIdParamSchema } from './validation/timetable.validation';

const router = Router();

router.use(authenticate);

const MANAGE_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

// A teacher's or student's own weekly schedule — declared before the generic '/' list.
router.get('/me', authorize(RoleName.TEACHER, RoleName.STUDENT), timetableController.getMyTimetable);

router.post('/', authorize(...MANAGE_ROLES), validate(createTimetableEntrySchema), timetableController.create);

router.get('/', authorize(...MANAGE_ROLES), validate(listTimetableQuerySchema, 'query'), timetableController.list);

router.delete(
  '/:id',
  authorize(...MANAGE_ROLES),
  validate(timetableEntryIdParamSchema, 'params'),
  timetableController.delete
);

export const timetableRoutes = router;
