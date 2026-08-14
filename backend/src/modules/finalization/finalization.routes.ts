import { Router } from 'express';
import { finalizationController } from './finalization.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  classroomFinalizationIdSchema,
  correctFinalizationSchema,
  finalizeClassroomSchema,
  finalizeSubjectSchema,
  reviewSubjectSchema,
  subjectFinalizationIdSchema,
  submitForReviewSchema,
} from './validation/finalization.validation';
import { RoleName } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Submit for review (Teacher only)
router.post(
  '/submit-for-review',
  authorize(RoleName.TEACHER),
  validate(submitForReviewSchema),
  finalizationController.submitForReview
);

// Review subject (Vice Director, Director, Admin)
router.post(
  '/review-subject',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  validate(reviewSubjectSchema),
  finalizationController.reviewSubject
);

// Finalize subject (Vice Director, Director, Admin)
router.post(
  '/finalize-subject',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  validate(finalizeSubjectSchema),
  finalizationController.finalizeSubject
);

// Finalize classroom (Vice Director, Director, Admin)
router.post(
  '/finalize-classroom',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  validate(finalizeClassroomSchema),
  finalizationController.finalizeClassroom
);

// Get subject finalization details  (?academicYear=2026%2F27)
router.get(
  '/subject/:teacherSubjectId/:semester',
  authorize(RoleName.TEACHER, RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  finalizationController.getSubjectFinalization
);

// Get classroom finalization details  (?academicYear=2026%2F27)
router.get(
  '/classroom/:classroomId/:semester',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  finalizationController.getClassroomFinalization
);

// Get all subject finalizations for a classroom  (?academicYear=2026%2F27)
router.get(
  '/classroom/:classroomId/:semester/subjects',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  finalizationController.getClassroomSubjectFinalizations
);

// Correct subject finalization (Vice Director, Director, Admin)
router.post(
  '/subject/:id/correct',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  validate(subjectFinalizationIdSchema, 'params'),
  validate(correctFinalizationSchema),
  finalizationController.correctSubjectFinalization
);

// Correct classroom finalization (Vice Director, Director, Admin)
router.post(
  '/classroom/:id/correct',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR, RoleName.ADMIN),
  validate(classroomFinalizationIdSchema, 'params'),
  validate(correctFinalizationSchema),
  finalizationController.correctClassroomFinalization
);

export default router;