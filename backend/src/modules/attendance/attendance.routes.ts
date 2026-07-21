import { Router } from 'express';
import { RoleName } from '@prisma/client';
import { attendanceController } from './attendance.controller';
import { authenticate } from '../../middlewares/authenticate.middleware';
import { authorize } from '../../middlewares/authorize.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  bulkMarkAttendanceSchema,
  updateAttendanceSchema,
  classroomAttendanceQuerySchema,
  studentAttendanceQuerySchema,
  attendanceSummaryQuerySchema,
  attendanceIdParamSchema,
  studentIdParamSchema,
} from './validation/attendance.validation';

const router = Router();

router.use(authenticate);

const OVERSIGHT_AND_TEACHER = [RoleName.ADMIN, RoleName.DIRECTOR, RoleName.VICE_DIRECTOR, RoleName.TEACHER];

// A student's own attendance — declared before the generic '/student/:studentId' routes.
router.get('/me', authorize(RoleName.STUDENT), validate(studentAttendanceQuerySchema, 'query'), attendanceController.getMyHistory);
router.get(
  '/me/summary',
  authorize(RoleName.STUDENT),
  validate(attendanceSummaryQuerySchema, 'query'),
  attendanceController.getMySummary
);

router.post(
  '/',
  authorize(RoleName.TEACHER),
  validate(bulkMarkAttendanceSchema),
  attendanceController.markBulk
);

router.get(
  '/',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(classroomAttendanceQuerySchema, 'query'),
  attendanceController.getClassroomAttendance
);

router.patch(
  '/:id',
  authorize(...OVERSIGHT_AND_TEACHER),
  validate(attendanceIdParamSchema, 'params'),
  validate(updateAttendanceSchema),
  attendanceController.update
);

// Any authenticated role may hit these — fine-grained access is enforced
// inside AttendanceService via assertCanAccessStudentRecords (Admin/Director/
// ViceDirector see everyone; a Teacher only their assigned classrooms;
// a Student only themselves; a Parent only their linked children).
router.get(
  '/student/:studentId',
  validate(studentIdParamSchema, 'params'),
  validate(studentAttendanceQuerySchema, 'query'),
  attendanceController.getStudentHistory
);

router.get(
  '/student/:studentId/summary',
  validate(studentIdParamSchema, 'params'),
  validate(attendanceSummaryQuerySchema, 'query'),
  attendanceController.getStudentSummary
);

export const attendanceRoutes = router;
