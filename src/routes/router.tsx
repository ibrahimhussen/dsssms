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
import { AcademicReportsPage } from '../pages/academic-reports/AcademicReportsPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';

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
            children: [{ path: '/users', element: <UsersPage /> }],
          },

          {
            element: <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']} />,
            children: [
              { path: '/students', element: <StudentsPage /> },
              { path: '/parents', element: <ParentsPage /> },
              { path: '/classrooms', element: <ClassroomsPage /> },
              { path: '/subjects', element: <SubjectsPage /> },
              { path: '/teaching-assignments', element: <TeacherAssignmentsPage /> },
              { path: '/academic-reports', element: <AcademicReportsPage /> },
            ],
          },

          {
            element: <ProtectedRoute allowedRoles={['TEACHER']} />,
            children: [
              { path: '/attendance', element: <AttendancePage /> },
              { path: '/grades', element: <GradesPage /> },
            ],
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