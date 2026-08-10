import { Link } from 'react-router-dom';
import { useAdminDashboard } from '../../hooks/useDashboardStats';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function AdminDashboard() {
  const { data, isLoading } = useAdminDashboard();
  const stats = data?.stats;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/users">
          <span className="text-sm font-semibold text-pine-700 hover:underline">Manage staff accounts</span>
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/audit-logs">
          <span className="text-sm font-semibold text-pine-700 hover:underline">View audit logs</span>
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/system-settings">
          <span className="text-sm font-semibold text-pine-700 hover:underline">System settings</span>
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/backups">
          <span className="text-sm font-semibold text-pine-700 hover:underline">Backup & restore</span>
        </Link>
      </div>

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard label="Total students" value={isLoading ? '—' : stats?.totalStudents} />
        <StatCard label="Total teachers" value={isLoading ? '—' : stats?.totalTeachers} />
        <StatCard label="Total parents" value={isLoading ? '—' : stats?.totalParents} />
        <StatCard label="Staff accounts" value={isLoading ? '—' : stats?.totalStaffAccounts} />
        <StatCard label="Subjects" value={isLoading ? '—' : stats?.totalSubjects} />
        <StatCard label="Classrooms" value={isLoading ? '—' : stats?.totalClassrooms} />
        <StatCard label="Active users today" value={isLoading ? '—' : stats?.activeUsersToday} />
        <StatCard
          label="System status"
          value={
            isLoading ? (
              '—'
            ) : (
              <Badge tone="positive">{stats?.systemStatus}</Badge>
            )
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-1">
        <Card>
          <h2 className="mb-3 text-lg">Newly registered students</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data || data.recentStudents.length === 0 ? (
            <EmptyState title="No students yet" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.recentStudents.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="text-right text-[0.75rem] text-slate-500">
                    {s.admissionNumber}
                    <br />
                    {formatDate(s.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg">Recently added teachers</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data || data.recentTeachers.length === 0 ? (
            <EmptyState title="No teachers yet" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.recentTeachers.map((t) => (
                <li key={t.teacherId} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink-900">
                    {t.firstName} {t.lastName}
                  </span>
                  <span className="text-[0.75rem] text-slate-500">{formatDate(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-lg">Recent user logins</h2>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !data || data.recentLogins.length === 0 ? (
            <EmptyState title="No logins recorded yet" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.recentLogins.map((u) => (
                <li key={u.userId} className="flex items-center justify-between gap-2">
                  <div>
                    <span className="block text-sm font-medium text-ink-900">{u.username}</span>
                    <Badge>{u.role.replace('_', ' ')}</Badge>
                  </div>
                  <span className="text-[0.75rem] text-slate-500">{formatDateTime(u.lastLoginAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
