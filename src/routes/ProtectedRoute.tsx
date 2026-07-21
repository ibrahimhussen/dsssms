import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleName } from '../types/auth';

interface ProtectedRouteProps {
  allowedRoles?: RoleName[];
}

/**
 * Guards a subtree of routes. With no `allowedRoles`, only requires the
 * user to be authenticated. With `allowedRoles`, also enforces RBAC —
 * matching the same role checks the backend applies on each endpoint, so
 * the UI never even offers a screen the API would reject.
 */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="full-page-loader" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
