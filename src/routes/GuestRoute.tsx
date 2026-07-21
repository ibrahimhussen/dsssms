import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
