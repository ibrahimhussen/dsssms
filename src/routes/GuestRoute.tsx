import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../lib/role-redirect';

export function GuestRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="full-page-loader" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  if (user) {
    // Redirect to the role-specific dashboard instead of always '/'.
    // All roles currently resolve to '/' (DashboardPage dispatches internally),
    // but the explicit call future-proofs this for role-specific landing routes.
    return <Navigate to={getRoleDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
}
