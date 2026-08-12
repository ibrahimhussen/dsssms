import { Router } from 'express';
import { academicRegisterController } from './academic-register.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  classroomRegisterSchema,
  gradeSummarySchema,
  historicalRegisterSchema,
} from './validation/academic-register.validation';
import { RoleName } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get academic register (Director, Vice Director, Admin only)
router.get(
  '/',
  authorize(RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN),
  validate(classroomRegisterSchema, 'query'),
  academicRegisterController.getRegister
);

// Get grade-wide summary (Director, Vice Director, Admin only)
router.get(
  '/grade/:grade/:academicYear/:semester',
  authorize(RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN),
  validate(gradeSummarySchema, 'params'),
  academicRegisterController.getGradeSummary
);

// Get historical register (Student can view own, others need oversight access)
router.get(
  '/historical/:studentId/:academicYear/:semester',
  authorize(RoleName.STUDENT, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN),
  validate(historicalRegisterSchema, 'params'),
  academicRegisterController.getHistoricalRegister
);

export default router;