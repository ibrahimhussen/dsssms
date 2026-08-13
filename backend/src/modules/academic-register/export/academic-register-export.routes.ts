import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { academicRegisterExportController } from './academic-register-export.controller';
import { authenticate } from '../../../middlewares/authenticate.middleware';
import { authorize } from '../../../middlewares/authorize.middleware';
import { validate } from '../../../middlewares/validate.middleware';
import { exportRegisterSchema } from '../validation/academic-register.validation';

const router = Router();
router.use(authenticate);

const ALLOWED = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

router.get(
  '/',
  authorize(...ALLOWED),
  validate(exportRegisterSchema, 'query'),
  academicRegisterExportController.exportRegister
);

export default router;
