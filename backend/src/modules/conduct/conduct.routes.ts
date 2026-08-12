import { Router } from 'express';
import { conductController } from './conduct.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  classroomConductQuerySchema,
  conductIdSchema,
  createConductSchema,
  updateConductSchema,
} from './validation/conduct.validation';
import { RoleName } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create or update conduct (Vice Director, Director only)
router.post(
  '/',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  validate(createConductSchema),
  conductController.upsertConduct
);

// Update conduct (Vice Director, Director only)
router.put(
  '/:id',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  validate(conductIdSchema, 'params'),
  validate(updateConductSchema),
  conductController.updateConduct
);

// Get student conduct (Student, Parent, Vice Director, Director)
router.get(
  '/student/:studentId/:classroomId/:semester/:academicYear',
  authorize(RoleName.STUDENT, RoleName.PARENT, RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  conductController.getStudentConduct
);

// Get classroom conducts (Vice Director, Director only)
router.get(
  '/classroom/:classroomId/:semester/:academicYear',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  validate(classroomConductQuerySchema, 'params'),
  conductController.getClassroomConducts
);

// Get classroom conduct summary (Vice Director, Director only)
router.get(
  '/classroom/:classroomId/:semester/:academicYear/summary',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  validate(classroomConductQuerySchema, 'params'),
  conductController.getClassroomConductSummary
);

// Delete conduct (Vice Director, Director only)
router.delete(
  '/:id',
  authorize(RoleName.VICE_DIRECTOR, RoleName.DIRECTOR),
  validate(conductIdSchema, 'params'),
  conductController.deleteConduct
);

export default router;