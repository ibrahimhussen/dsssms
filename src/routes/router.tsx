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
          { path: '/students', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><StudentsPage /></ProtectedRoute> },
          { path: '/parents', element: <ProtectedRoute allowedRoles={['DIRECTOR']}><ParentsPage /></ProtectedRoute> },
          { path: '/classrooms', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><ClassroomsPage /></ProtectedRoute> },
          { path: '/subjects', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><SubjectsPage /></ProtectedRoute> },
          { path: '/teaching-assignments', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><TeacherAssignmentsPage /></ProtectedRoute> },
          { path: '/timetable-admin', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><TimetableAdminPage /></ProtectedRoute> },
          { path: '/attendance-reports', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AttendanceReportsPage /></ProtectedRoute> },
          { path: '/academic-reports', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AcademicReportsPage /></ProtectedRoute> },
          { path: '/school-performance', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><SchoolPerformancePage /></ProtectedRoute> },
          { path: '/discipline-records', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'TEACHER']}><DisciplineRecordsPage /></ProtectedRoute> },
          { path: '/announcements', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR']}><AnnouncementsPage /></ProtectedRoute> },

          { path: '/my-classes', element: <ProtectedRoute allowedRoles={['TEACHER']}><MyClassesPage /></ProtectedRoute> },
          { path: '/attendance', element: <ProtectedRoute allowedRoles={['DIRECTOR', 'VICE_DIRECTOR', 'TEACHER']}><AttendancePage /></ProtectedRoute> },
          { path: '/grades', element: <ProtectedRoute allowedRoles={['TEACHER']}><GradesPage /></ProtectedRoute> },
          { path: '/homework', element: <ProtectedRoute allowedRoles={['TEACHER']}><TeacherHomeworkPage /></ProtectedRoute> },

          { path: '/my-attendance', element: <ProtectedRoute allowedRoles={['STUDENT']}><MyAttendancePage /></ProtectedRoute> },
          { path: '/my-grades', element: <ProtectedRoute allowedRoles={['STUDENT']}><MyGradesPage /></ProtectedRoute> },
          { path: '/transcript', element: <ProtectedRoute allowedRoles={['STUDENT']}><TranscriptPage /></ProtectedRoute> },
          { path: '/my-homework', element: <ProtectedRoute allowedRoles={['STUDENT']}><StudentHomeworkPage /></ProtectedRoute> },

          { path: '/timetable', element: <ProtectedRoute allowedRoles={['TEACHER', 'STUDENT']}><TimetablePage /></ProtectedRoute> },

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