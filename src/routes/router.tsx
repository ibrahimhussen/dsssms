import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../routes/ProtectedRoute'
import { GuestRoute } from './GuestRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { UnauthorizedPage } from '../pages/errors/UnauthorizedPage';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import { UsersPage } from '../pages/users/UsersPage';
import { StudentsPage } from '../pages/students/StudentsPage';
import { ParentsPage } from '../pages/parents/ParentsPage';
import { ClassroomsPage } from '../pages/classrooms/ClassroomsPage';
import { SubjectsPage } from '../pages/subjects/SubjectsPage';
import { TeacherAssignmentsPage } from '../pages/teacher-subjects/TeacherAssignmentsPage';
import { AttendancePage } from '../pages/attendance/AttendancePage';
import { GradesPage } from '../pages/grades/GradesPage';
import { MyClassesPage } from '../pages/my-classes/MyClassesPage';
import { AcademicReportsPage } from '../pages/academic-reports/AcademicReportsPage';
import { AcademicRegisterPage } from '../pages/academic-register/AcademicRegisterPage';
import { FinalizationPage } from '../pages/finalization/FinalizationPage';
import { ConductPage } from '../pages/conduct/ConductPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { MyAttendancePage } from '../pages/my-attendance/MyAttendancePage';
import { MyGradesPage } from '../pages/my-grades/MyGradesPage';
import { TranscriptPage } from '../pages/transcript/TranscriptPage';
import { TimetablePage } from '../pages/timetable/TimetablePage';
import { TimetableAdminPage } from '../pages/timetable-admin/TimetableAdminPage';
import { TeacherHomeworkPage } from '../pages/homework/TeacherHomeworkPage';
import { StudentHomeworkPage } from '../pages/my-homework/StudentHomeworkPage';
import { AuditLogsPage } from '../pages/audit-logs/AuditLogsPage';
import { SystemSettingsPage } from '../pages/system-settings/SystemSettingsPage';
import { BackupRestorePage } from '../pages/backups/BackupRestorePage';
import { TeachersPage } from '../pages/teachers/TeachersPage';
import { SchoolPerformancePage } from '../pages/school-performance/SchoolPerformancePage';
import { DisciplineRecordsPage } from '../pages/discipline/DisciplineRecordsPage';
import { AttendanceReportsPage } from '../pages/attendance/AttendanceReportsPage';
import { AnnouncementsPage } from '../pages/announcements/AnnouncementsPage';
import { ProfilePage } from '../pages/profile/ProfilePage';
import { PromotionPage } from '../pages/promotion/PromotionPage';
import { PromotionBatchPage } from '../pages/promotion/PromotionBatchPage';
import { PromotionApprovePage } from '../pages/promotion/PromotionApprovePage';
import { ParentChildrenPage } from '../pages/parent/ParentChildrenPage';
import { ParentAttendancePage } from '../pages/parent/ParentAttendancePage';
import { ParentAssessmentPage } from '../pages/parent/ParentAssessmentPage';
import { ParentResultsPage } from '../pages/parent/ParentResultsPage';
import { ParentTranscriptPage } from '../pages/parent/ParentTranscriptPage';
import { ParentMessagesPage } from '../pages/parent/ParentMessagesPage';
import { TeacherMessagesPage } from '../pages/messages/TeacherMessagesPage';
import { ReportCardPage } from '../pages/report-card/ReportCardPage';
import { ParentReportCardPage } from '../pages/parent/ParentReportCardPage';
import { GradeSubjectConfigPage } from '../pages/grade-subject-config/GradeSubjectConfigPage';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },

          { path: '/users', element: <ProtectedRoute allowedRoles={['ADMIN']}><UsersPage /></ProtectedRoute> },
          { path: '/audit-logs', element: <ProtectedRoute allowedRoles={['ADMIN']}><AuditLogsPage /></ProtectedRoute> },
          { path: '/system-settings', element: <ProtectedRoute allowedRoles={['ADMIN']}><SystemSettingsPage /></ProtectedRoute> },
          { path: '/backups', element: <ProtectedRoute allowedRoles={['ADMIN']}><BackupRestorePage /></ProtectedRoute> },

          { path: '/teachers', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><TeachersPage /></ProtectedRoute> },
          { path: '/students', element: <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']}><StudentsPage /></ProtectedRoute> },
          { path: '/parents', element: <ProtectedRoute allowedRoles={['DIRECTOR']}><ParentsPage /></ProtectedRoute> },
          { path: '/classrooms', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><ClassroomsPage /></ProtectedRoute> },
          { path: '/subjects', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><SubjectsPage /></ProtectedRoute> },
          { path: '/teaching-assignments', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><TeacherAssignmentsPage /></ProtectedRoute> },
          { path: '/timetable-admin', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><TimetableAdminPage /></ProtectedRoute> },
          { path: '/attendance-reports', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AttendanceReportsPage /></ProtectedRoute> },
          { path: '/academic-reports', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AcademicReportsPage /></ProtectedRoute> },
          { path: '/academic-register', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'ADMIN']}><AcademicRegisterPage /></ProtectedRoute> },
          { path: '/finalization', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'ADMIN']}><FinalizationPage /></ProtectedRoute> },
          { path: '/conduct', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><ConductPage /></ProtectedRoute> },
          { path: '/school-performance', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><SchoolPerformancePage /></ProtectedRoute> },
          { path: '/discipline-records', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'TEACHER']}><DisciplineRecordsPage /></ProtectedRoute> },
          { path: '/announcements', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AnnouncementsPage /></ProtectedRoute> },

          { path: '/promotion', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><PromotionPage /></ProtectedRoute> },
          { path: '/promotion/:id', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><PromotionBatchPage /></ProtectedRoute> },
          { path: '/promotion/:id/approve', element: <ProtectedRoute allowedRoles={['DIRECTOR']}><PromotionApprovePage /></ProtectedRoute> },

          { path: '/grade-subject-config', element: <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']}><GradeSubjectConfigPage /></ProtectedRoute> },

          { path: '/my-classes', element: <ProtectedRoute allowedRoles={['TEACHER']}><MyClassesPage /></ProtectedRoute> },
          { path: '/attendance', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'TEACHER']}><AttendancePage /></ProtectedRoute> },
          { path: '/grades', element: <ProtectedRoute allowedRoles={['TEACHER']}><GradesPage /></ProtectedRoute> },
          { path: '/homework', element: <ProtectedRoute allowedRoles={['TEACHER']}><TeacherHomeworkPage /></ProtectedRoute> },

          { path: '/my-attendance', element: <ProtectedRoute allowedRoles={['STUDENT']}><MyAttendancePage /></ProtectedRoute> },
          { path: '/my-grades', element: <ProtectedRoute allowedRoles={['STUDENT']}><MyGradesPage /></ProtectedRoute> },
          { path: '/report-card', element: <ProtectedRoute allowedRoles={['STUDENT']}><ReportCardPage /></ProtectedRoute> },
          { path: '/transcript', element: <ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'PARENT']}><TranscriptPage /></ProtectedRoute> },
          { path: '/my-homework', element: <ProtectedRoute allowedRoles={['STUDENT']}><StudentHomeworkPage /></ProtectedRoute> },

          { path: '/timetable', element: <ProtectedRoute allowedRoles={['TEACHER', 'STUDENT']}><TimetablePage /></ProtectedRoute> },

          // ── PARENT routes ────────────────────────────────────────────────
          { path: '/parent/children',   element: <ProtectedRoute allowedRoles={['PARENT']}><ParentChildrenPage /></ProtectedRoute> },
          { path: '/parent/attendance', element: <ProtectedRoute allowedRoles={['PARENT']}><ParentAttendancePage /></ProtectedRoute> },
          { path: '/parent/assessment', element: <ProtectedRoute allowedRoles={['PARENT']}><ParentAssessmentPage /></ProtectedRoute> },
          { path: '/parent/results',    element: <ProtectedRoute allowedRoles={['PARENT']}><ParentResultsPage /></ProtectedRoute> },
          { path: '/parent/transcript', element: <ProtectedRoute allowedRoles={['PARENT']}><ParentTranscriptPage /></ProtectedRoute> },
          { path: '/parent/messages',   element: <ProtectedRoute allowedRoles={['PARENT']}><ParentMessagesPage /></ProtectedRoute> },
          { path: '/parent/report-card', element: <ProtectedRoute allowedRoles={['PARENT']}><ParentReportCardPage /></ProtectedRoute> },

          // ── TEACHER messages ─────────────────────────────────────────────
          { path: '/messages', element: <ProtectedRoute allowedRoles={['TEACHER']}><TeacherMessagesPage /></ProtectedRoute> },

          // Visible to every authenticated role — no role restriction in nav-config.
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);