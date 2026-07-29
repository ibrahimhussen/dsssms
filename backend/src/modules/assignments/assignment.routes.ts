import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { assignmentController } from './assignment.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  assignmentIdParamSchema,
  assignmentStudentParamSchema,
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  markMySubmissionSchema,
  updateSubmissionStatusSchema,
} from './validation/assignment.validation';

const router = Router();

router.use(authenticate);

// A teacher's own assignments, or a student's own classroom assignments.
router.get(
  '/me',
  authorize(RoleName.TEACHER, RoleName.STUDENT),
  validate(listAssignmentsQuerySchema, 'query'),
  assignmentController.getMine
);

router.post('/', authorize(RoleName.TEACHER), validate(createAssignmentSchema), assignmentController.create);

router.get(
  '/:id/submissions',
  authorize(RoleName.TEACHER),
  validate(assignmentIdParamSchema, 'params'),
  assignmentController.getSubmissions
);

router.patch(
  '/:id/submissions/:studentId',
  authorize(RoleName.TEACHER),
  validate(assignmentStudentParamSchema, 'params'),
  validate(updateSubmissionStatusSchema),
  assignmentController.updateSubmissionStatus
);

// Student self-report: mark their own submission for assignment :id.
router.patch(
  '/:id/submission',
  authorize(RoleName.STUDENT),
  validate(assignmentIdParamSchema, 'params'),
  validate(markMySubmissionSchema),
  assignmentController.markMySubmission
);

router.delete(
  '/:id',
  authorize(RoleName.TEACHER),
  validate(assignmentIdParamSchema, 'params'),
  assignmentController.delete
);

export const assignmentRoutes = router;
