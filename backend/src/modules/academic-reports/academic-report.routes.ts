import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { academicReportController } from './academic-report.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  generateClassroomReportsSchema,
  reportPeriodQuerySchema,
  studentIdParamSchema,
} from './validation/academic-report.validation';

const router = Router();

router.use(authenticate);

const OVERSIGHT_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

router.get('/me', authorize(RoleName.STUDENT), academicReportController.getMyReports);

router.post(
  '/generate',
  authorize(...OVERSIGHT_ROLES),
  validate(generateClassroomReportsSchema),
  academicReportController.generateForClassroom
);

// Fine-grained access enforced inside AcademicReportService via assertCanAccessStudentRecords.
router.get(
  '/student/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(reportPeriodQuerySchema, 'query'),
  academicReportController.getStudentReport
);

router.get(
  '/student/:studentId/history',
  validate(studentIdParamSchema, 'params'),
  academicReportController.listStudentReports
);

export const academicReportRoutes = router;
