import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../lib/role-labels';
import { LedgerRule } from '../../components/ui/LedgerRule';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="page">
      <h1 className="page-title">Welcome, {user.username}</h1>
      <LedgerRule />
      <p className="page-lead">
        Signed in as <strong>{getRoleLabel(user.role)}</strong>. Your role-specific dashboard is on its way.
      </p>
    </div>
  );
}
