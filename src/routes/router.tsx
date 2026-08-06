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

          {
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [
              { path: '/users', element: <UsersPage /> },
              { path: '/audit-logs', element: <AuditLogsPage /> },
              { path: '/system-settings', element: <SystemSettingsPage /> },
              { path: '/backups', element: <BackupRestorePage /> },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']} />,
            children: [
              { path: '/students', element: <StudentsPage /> },
              { path: '/parents', element: <ParentsPage /> },
              { path: '/classrooms', element: <ClassroomsPage /> },
              { path: '/subjects', element: <SubjectsPage /> },
              { path: '/teaching-assignments', element: <TeacherAssignmentsPage /> },
              { path: '/timetable-admin', element: <TimetableAdminPage /> },
              { path: '/academic-reports', element: <AcademicReportsPage /> },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={['TEACHER']} />,
            children: [
              { path: '/my-classes', element: <MyClassesPage /> },
              { path: '/attendance', element: <AttendancePage /> },
              { path: '/grades', element: <GradesPage /> },
              { path: '/homework', element: <TeacherHomeworkPage /> },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={['STUDENT']} />,
            children: [
              { path: '/my-attendance', element: <MyAttendancePage /> },
              { path: '/my-grades', element: <MyGradesPage /> },
              { path: '/transcript', element: <TranscriptPage /> },
              { path: '/my-homework', element: <StudentHomeworkPage /> },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={['TEACHER', 'STUDENT']} />,
            children: [{ path: '/timetable', element: <TimetablePage /> }],
          },

          // Visible to every authenticated role — no role restriction in nav-config.
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);