import { useDirectorDashboard } from '../../hooks/useDashboardStats';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart, LineChart } from '../../components/ui/Charts';
import { chartColors } from '../../components/ui/chart-colors';

export function DirectorDashboard() {
  const { data, isLoading } = useDirectorDashboard();
  const stats = data?.stats;
  const charts = data?.charts;

  return (
    <>
      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard label="Total students" value={isLoading ? '—' : stats?.totalStudents} />
        <StatCard label="Total teachers" value={isLoading ? '—' : stats?.totalTeachers} />
        <StatCard label="Attendance rate" value={isLoading ? '—' : `${stats?.attendanceRateToday ?? 0}%`} />
        <StatCard label="Overall average score" value={isLoading ? '—' : `${stats?.overallAverageScore ?? 0}%`} />
        <StatCard
          label="Top performing grade"
          value={
            isLoading ? (
              '—'
            ) : stats?.topPerformingGrade ? (
              <span className="text-xl">
                {stats.topPerformingGrade.classroomLabel}{' '}
                <Badge tone="positive">{stats.topPerformingGrade.averageScore}%</Badge>
              </span>
            ) : (
              '—'
            )
          }
        />
        <StatCard label="Pending academic reports" value={isLoading ? '—' : stats?.pendingAcademicReports} />
      </div>

      <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
        <Card>
          <h2 className="mb-4 text-lg">Student performance by grade</h2>
          <BarChart
            data={(charts?.performanceByGrade ?? []).map((p) => ({ label: p.classroomLabel, value: p.averageScore }))}
            valueSuffix="%"
            emptyLabel="No academic reports generated yet"
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Attendance trend (last 7 days)</h2>
          <LineChart
            data={(charts?.attendanceTrend ?? []).map((p) => ({
              label: new Date(p.date).toLocaleDateString(undefined, { weekday: 'short' }),
              value: p.presentPercentage,
            }))}
            valueSuffix="%"
            color={chartColors.pine}
            emptyLabel="No attendance recorded yet"
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Subject performance</h2>
          <BarChart
            data={(charts?.subjectPerformance ?? []).map((p) => ({ label: p.subjectName, value: p.averageScore }))}
            valueSuffix="%"
            color={chartColors.gold}
            emptyLabel="No grades entered yet"
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Pass rate analysis</h2>
          <BarChart
            data={(charts?.passRateAnalysis ?? []).map((p) => ({ label: p.classroomLabel, value: p.passRate }))}
            valueSuffix="%"
            color={chartColors.pine}
            emptyLabel="No academic reports generated yet"
          />
        </Card>
      </div>
    </>
  );
}
