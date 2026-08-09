import { Link } from 'react-router-dom';
import { useViceDirectorDashboard } from '../../hooks/useDashboardStats';
import { Card, StatCard } from '../../components/ui/Card';
import { DonutChart, LineChart } from '../../components/ui/Charts';
import { chartColors } from '../../components/ui/chart-colors';

const STATUS_COLORS: Record<string, string> = {
  PRESENT: chartColors.pine,
  ABSENT: chartColors.danger,
  LATE: chartColors.gold,
  EXCUSED: chartColors.slate,
};

const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
};

export function ViceDirectorDashboard() {
  const { data, isLoading } = useViceDirectorDashboard();
  const stats = data?.stats;
  const charts = data?.charts;

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link to="/students" className="text-sm font-semibold text-pine-700 hover:underline">
          View student records
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/teaching-assignments" className="text-sm font-semibold text-pine-700 hover:underline">
          Assign teachers
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/timetable-admin" className="text-sm font-semibold text-pine-700 hover:underline">
          Manage timetable
        </Link>
        <span className="text-slate-300">·</span>
        <Link to="/academic-reports" className="text-sm font-semibold text-pine-700 hover:underline">
          Review reports
        </Link>
      </div>

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard label="Present today" value={isLoading ? '—' : stats?.studentsPresentToday} />
        <StatCard label="Absent today" value={isLoading ? '—' : stats?.studentsAbsentToday} />
        <StatCard label="Total teachers" value={isLoading ? '—' : stats?.totalTeachers} />
        <StatCard label="Total classes" value={isLoading ? '—' : stats?.totalClasses} />
        <StatCard label="Attendance %" value={isLoading ? '—' : `${stats?.attendancePercentageToday ?? 0}%`} />
        <StatCard label="Pending attendance reports" value={isLoading ? '—' : stats?.pendingAttendanceReports} />
      </div>

      <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
        <Card>
          <h2 className="mb-4 text-lg">Daily attendance</h2>
          <DonutChart
            data={(charts?.dailyAttendance ?? []).map((d) => ({
              label: STATUS_LABELS[d.status] ?? d.status,
              value: d.count,
              color: STATUS_COLORS[d.status] ?? chartColors.slate,
            }))}
            emptyLabel="No attendance recorded today"
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Weekly attendance</h2>
          <LineChart
            data={(charts?.weeklyAttendance ?? []).map((p) => ({
              label: new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }),
              value: p.presentPercentage,
            }))}
            valueSuffix="%"
            emptyLabel="No attendance recorded this week"
          />
        </Card>
      </div>
    </>
  );
}
