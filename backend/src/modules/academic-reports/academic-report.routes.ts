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
router.get('/me/transcript', authorize(RoleName.STUDENT), academicReportController.getMyTranscript);

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
  '/student/:studentId/pdf',
  validate(studentIdParamSchema, 'params'),
  validate(reportPeriodQuerySchema, 'query'),
  academicReportController.getReportCardPdf
);

router.get(
  '/student/:studentId/history',
  validate(studentIdParamSchema, 'params'),
  academicReportController.listStudentReports
);

router.get(
  '/student/:studentId/transcript',
  validate(studentIdParamSchema, 'params'),
  academicReportController.getTranscript
);

router.get(
  '/student/:studentId/transcript/pdf',
  validate(studentIdParamSchema, 'params'),
  academicReportController.getTranscriptPdf
);

export const academicReportRoutes = router;
