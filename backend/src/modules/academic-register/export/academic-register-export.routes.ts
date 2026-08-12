import { Router } from 'express';
import { academicRegisterExportController } from './academic-register-export.controller';
import { authenticate } from '../../../middlewares/authenticate.middleware';
import { authorize } from '../../../middlewares/authorize.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import {
  classroomRegisterSchema,
} from '../validation/academic-register.validation';
import { RoleName } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Export to Excel (Director, Vice Director, Admin only)
router.get(
  '/excel',
  authorize(RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN),
  validate(classroomRegisterSchema, 'query'),
  academicRegisterExportController.exportToExcel
);

// Export to CSV (Director, Vice Director, Admin only)
router.get(
  '/csv',
  authorize(RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.ADMIN),
  validate(classroomRegisterSchema, 'query'),
  academicRegisterExportController.exportToCSV
);

export default router;