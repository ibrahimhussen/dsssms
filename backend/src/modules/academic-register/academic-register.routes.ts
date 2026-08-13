import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { academicRegisterController } from './academic-register.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  classroomRegisterSchema,
  gradeRegisterSchema,
} from './validation/academic-register.validation';

const router = Router();
router.use(authenticate);

const OVERSIGHT = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

// Classroom register — oversight roles AND teachers (teacher-level auth
// is enforced inside the service, which checks TeacherSubject assignments
// and homeroom teacher status for this classroom).
router.get(
  '/',
  authorize(...OVERSIGHT, RoleName.TEACHER),
  validate(classroomRegisterSchema, 'query'),
  academicRegisterController.getRegister
);

// Grade-wide summary — oversight only (teachers see section register, not
// cross-section grade summaries).
router.get(
  '/grade',
  authorize(...OVERSIGHT),
  validate(gradeRegisterSchema, 'query'),
  academicRegisterController.getGradeRegister
);

export default router;
