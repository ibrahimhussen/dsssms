import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { GuestRoute } from './GuestRoute';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/auth/LoginPage';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { UnauthorizedPage } from '../pages/errors/UnauthorizedPage';
import { NotFoundPage } from '../pages/errors/NotFoundPage';

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
          // Stage 8+ routes are added here, each optionally wrapped in its
          // own <ProtectedRoute allowedRoles={[...]}> for role-specific pages.
        ],
      },
    ],
  },
  { path: '/unauthorized', element: <UnauthorizedPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
