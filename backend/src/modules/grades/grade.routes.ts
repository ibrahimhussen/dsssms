import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { gradeController } from './grade.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  createGradeComponentSchema,
  gradeComponentIdParamSchema,
  gradeComponentQuerySchema,
  recordComponentEntriesSchema,
  studentGradesQuerySchema,
  studentIdParamSchema,
} from './validation/grade.validation';

const router = Router();

router.use(authenticate);

const OVERSIGHT_AND_TEACHER = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];

// A student's own grades — declared before the generic '/student/:studentId' route.
router.get('/me', authorize(RoleName.STUDENT), validate(studentGradesQuerySchema, 'query'), gradeController.getMyGrades);

// Grading scheme (the assessment components that make up a subject's /100).
router.post(
  '/components',
  authorize(RoleName.TEACHER),
  validate(createGradeComponentSchema),
  gradeController.createComponent
);

router.get(
  '/components',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(gradeComponentQuerySchema, 'query'),
  gradeController.listComponents
);

router.delete(
  '/components/:id',
  authorize(RoleName.TEACHER),
  validate(gradeComponentIdParamSchema, 'params'),
  gradeController.deleteComponent
);

// Scores for one component.
router.post(
  '/components/:id/entries',
  authorize(RoleName.TEACHER),
  validate(gradeComponentIdParamSchema, 'params'),
  validate(recordComponentEntriesSchema),
  gradeController.recordComponentEntries
);

router.get(
  '/components/:id/entries',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(gradeComponentIdParamSchema, 'params'),
  gradeController.getComponentRoster
);

// Every student's running total for a subject/semester scheme.
router.get(
  '/classroom-totals',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(gradeComponentQuerySchema, 'query'),
  gradeController.getClassroomTotals
);

// Fine-grained access enforced inside GradeService via assertCanAccessStudentRecords.
router.get(
  '/student/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(studentGradesQuerySchema, 'query'),
  gradeController.getStudentGrades
);

export const gradeRoutes = router;
