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

const OVERSIGHT_ROLES = [RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];
const TRANSCRIPT_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.STUDENT, RoleName.PARENT];

router.get('/me', authorize(RoleName.STUDENT), academicReportController.getMyReports);
router.get('/me/transcript', authorize(RoleName.STUDENT), academicReportController.getMyTranscript);
router.get('/me/transcript/pdf', authorize(RoleName.STUDENT), academicReportController.getMyTranscriptPdf);
router.get('/me/report-card', authorize(RoleName.STUDENT), validate(reportPeriodQuerySchema, 'query'), academicReportController.getMyReportCard);

router.post(
  '/generate',
  authorize(...OVERSIGHT_ROLES),
  validate(generateClassroomReportsSchema),
  academicReportController.generateForClassroom
);

// Transcript endpoints — fine-grained per-student authorization enforced inside
// AcademicReportService via assertCanAccessStudentRecords (student sees own only,
// parent sees linked children only, oversight/admin see any).
router.get(
  '/student/:studentId',
  authorize(...TRANSCRIPT_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(reportPeriodQuerySchema, 'query'),
  academicReportController.getStudentReport
);

// PDF endpoints — only oversight staff (Director/ViceDirector/Admin) get the pdfkit PDF.
// Students use /me/transcript/pdf. Parents use the frontend HTML print path.
const PDF_ROLES = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR];

router.get(
  '/student/:studentId/pdf',
  authorize(...TRANSCRIPT_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(reportPeriodQuerySchema, 'query'),
  academicReportController.getReportCardPdf
);

router.get(
  '/student/:studentId/history',
  authorize(...TRANSCRIPT_ROLES),
  validate(studentIdParamSchema, 'params'),
  academicReportController.listStudentReports
);

router.get(
  '/student/:studentId/transcript',
  authorize(...TRANSCRIPT_ROLES),
  validate(studentIdParamSchema, 'params'),
  academicReportController.getTranscript
);

router.get(
  '/student/:studentId/report-card',
  authorize(...TRANSCRIPT_ROLES),
  validate(studentIdParamSchema, 'params'),
  validate(reportPeriodQuerySchema, 'query'),
  academicReportController.getStudentReportCard
);

router.get(
  '/student/:studentId/transcript/pdf',
  authorize(...PDF_ROLES),
  validate(studentIdParamSchema, 'params'),
  academicReportController.getTranscriptPdf
);

export const academicReportRoutes = router;
