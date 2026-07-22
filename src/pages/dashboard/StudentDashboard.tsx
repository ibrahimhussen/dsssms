import { useMyAttendanceSummary } from '../../hooks/useDashboardData';
import { StatCard } from '../../components/ui/Card';

export function StudentDashboard() {
  const { data, isLoading } = useMyAttendanceSummary();

  return (
    <>
      <h2 className="mb-3 text-lg">Your attendance</h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <StatCard label="Present" value={isLoading ? '—' : data?.present} />
        <StatCard label="Absent" value={isLoading ? '—' : data?.absent} />
        <StatCard label="Late" value={isLoading ? '—' : data?.late} />
        <StatCard label="Excused" value={isLoading ? '—' : data?.excused} />
        <StatCard label="Attendance rate" value={isLoading ? '—' : `${data?.presentPercentage ?? 0}%`} />
      </div>
    </>
  );
}
