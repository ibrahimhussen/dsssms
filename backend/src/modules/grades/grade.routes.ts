import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { gradeController } from './grade.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  bulkRecordGradesSchema,
  updateGradeSchema,
  classroomGradesQuerySchema,
  studentGradesQuerySchema,
  gradeIdParamSchema,
  studentIdParamSchema,
} from './validation/grade.validation';

const router = Router();

router.use(authenticate);

const OVERSIGHT_AND_TEACHER = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];

// A student's own grades — declared before the generic '/student/:studentId' route.
router.get('/me', authorize(RoleName.STUDENT), validate(studentGradesQuerySchema, 'query'), gradeController.getMyGrades);

router.post('/', authorize(RoleName.TEACHER), validate(bulkRecordGradesSchema), gradeController.recordBulk);

router.get(
  '/',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(classroomGradesQuerySchema, 'query'),
  gradeController.getClassroomGrades
);

router.patch(
  '/:id',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(gradeIdParamSchema, 'params'),
  validate(updateGradeSchema),
  gradeController.update
);

// Fine-grained access enforced inside GradeService via assertCanAccessStudentRecords.
router.get(
  '/student/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(studentGradesQuerySchema, 'query'),
  gradeController.getStudentGrades
);

export const gradeRoutes = router;
