import { useAuth } from '../../context/AuthContext';
import { getRoleLabel } from '../../lib/role-labels';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { AdminDashboard } from './AdminDashboard';
import { DirectorDashboard } from './DirectorDashboard';
import { ViceDirectorDashboard } from './ViceDirectorDashboard';
import { TeacherDashboard } from './TeacherDashboard';
import { StudentDashboard } from './StudentDashboard';
import { ParentDashboard } from './ParentDashboard';

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Welcome, {user.username}</h1>
      <p className="mb-1 text-[0.9375rem] text-ink-700">
        Signed in as <strong>{getRoleLabel(user.role)}</strong>
      </p>
      <LedgerRule />

      {user.role === 'ADMIN' && <AdminDashboard />}
      {user.role === 'DIRECTOR' && <DirectorDashboard />}
      {user.role === 'VICE_DIRECTOR' && <ViceDirectorDashboard />}
      {user.role === 'TEACHER' && <TeacherDashboard />}
      {user.role === 'STUDENT' && <StudentDashboard />}
      {user.role === 'PARENT' && <ParentDashboard />}
    </div>
  );
}
