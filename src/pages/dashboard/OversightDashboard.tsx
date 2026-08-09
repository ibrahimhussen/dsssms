import { Link } from 'react-router-dom';
import { useDirectorDashboard } from '../../hooks/useDashboardStats';
import { StatCard, Card } from '../../components/ui/Card';

export function OversightDashboard() {
  const { data, isLoading } = useDirectorDashboard();

  return (
    <>
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
        <StatCard label="Students enrolled" value={isLoading ? '—' : data?.stats?.totalStudents} />
        <StatCard label="Teachers" value={isLoading ? '—' : data?.stats?.totalTeachers} />
        <StatCard label="Attendance rate" value={isLoading ? '—' : `${data?.stats?.attendanceRateToday ?? 0}%`} />
      </div>

      <Card>
        <h2 className="mb-3 text-lg">Quick links</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/users" className="text-sm font-semibold text-pine-700 hover:underline">
            Manage staff accounts
          </Link>
          <span className="text-slate-300">·</span>
          <Link to="/students" className="text-sm font-semibold text-pine-700 hover:underline">
            Manage students
          </Link>
        </div>
      </Card>
    </>
  );
}
