import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { userRoutes } from '../modules/users/user.routes';
import { studentRoutes } from '../modules/students/student.routes';
import { parentRoutes } from '../modules/parents/parent.routes';
import { classroomRoutes } from '../modules/classrooms/classroom.routes';
import { subjectRoutes } from '../modules/subjects/subject.routes';
import { teacherSubjectRoutes } from '../modules/teacher-subjects/teacher-subject.routes';
import { attendanceRoutes } from '../modules/attendance/attendance.routes';
import { gradeRoutes } from '../modules/grades/grade.routes';
import { academicReportRoutes } from '../modules/academic-reports/academic-report.routes';
import { notificationRoutes } from '../modules/notifications/notification.routes';
import { timetableRoutes } from '../modules/timetable/timetable.routes';
import { assignmentRoutes } from '../modules/assignments/assignment.routes';
import { dashboardRoutes } from '../modules/dashboard/dashboard.routes';
import { auditLogRoutes } from '../modules/audit-logs/audit-log.routes';
import { systemSettingRoutes } from '../modules/system-settings/system-setting.routes';
import { backupRoutes } from '../modules/backups/backup.routes';
import { disciplineRoutes } from '../modules/discipline/discipline.routes';
import { promotionRoutes } from '../modules/promotion/promotion.routes';
import finalizationRoutes from '../modules/finalization/finalization.routes';
import conductRoutes from '../modules/conduct/conduct.routes';
import academicRegisterRoutes from '../modules/academic-register/academic-register.routes';
import academicRegisterExportRoutes from '../modules/academic-register/export/academic-register-export.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/students', studentRoutes);
router.use('/parents', parentRoutes);
router.use('/classrooms', classroomRoutes);
router.use('/subjects', subjectRoutes);
router.use('/teacher-subjects', teacherSubjectRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/grades', gradeRoutes);
router.use('/academic-reports', academicReportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/timetable', timetableRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/system-settings', systemSettingRoutes);
router.use('/backups', backupRoutes);
router.use('/discipline-records', disciplineRoutes);
router.use('/promotion', promotionRoutes);
router.use('/finalization', finalizationRoutes);
router.use('/conduct', conductRoutes);
router.use('/academic-register', academicRegisterRoutes);
router.use('/academic-register/export', academicRegisterExportRoutes);

// Backend API surface complete. Stage 7+ builds the frontend against these routes.

export const apiRoutes = router;
