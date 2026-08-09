import { useState } from 'react';
import { useClassroomOptions } from '../../hooks/useClassrooms';
import { useViceDirectorDashboard } from '../../hooks/useDashboardStats';
import { Card, StatCard } from '../../components/ui/Card';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { BarChart, LineChart } from '../../components/ui/Charts';
import { chartColors } from '../../components/ui/chart-colors';

export function AttendanceReportsPage() {
  const { data: classroomsData } = useClassroomOptions();
  const { data: dashboardData, isLoading } = useViceDirectorDashboard();

  const [classroomId, setClassroomId] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().slice(0, 10));

  const stats = dashboardData?.stats;
  const charts = dashboardData?.charts;

  function handleExportCSV() {
    const csvContent =
      'Date,Classroom,Present,Absent,Attendance Rate\n' +
      `${dateFilter},All Classrooms,${stats?.studentsPresentToday ?? 0},${stats?.studentsAbsentToday ?? 0},${stats?.attendancePercentageToday ?? 0}%\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_report_${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">School-Wide Attendance Reports</h1>
          <p className="text-sm text-slate-500">Monitor school attendance metrics, daily reports, and classroom trends</p>
        </div>
        <Button variant="secondary" onClick={handleExportCSV}>
          Export CSV Report
        </Button>
      </div>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <SelectField
          label="Filter Classroom"
          className="min-w-[200px]"
          value={classroomId}
          onChange={(e) => setClassroomId(e.target.value)}
        >
          <option value="">All Classrooms</option>
          {classroomsData?.items.map((c) => (
            <option key={c.classroomId} value={c.classroomId}>
              {c.className} {c.section} ({c.academicYear})
            </option>
          ))}
        </SelectField>

        <TextField
          label="Report Date"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Present Today" value={isLoading ? '—' : stats?.studentsPresentToday} />
        <StatCard label="Absent Today" value={isLoading ? '—' : stats?.studentsAbsentToday} />
        <StatCard label="Daily Rate" value={isLoading ? '—' : `${stats?.attendancePercentageToday ?? 0}%`} />
        <StatCard label="Pending Class Reports" value={isLoading ? '—' : stats?.pendingAttendanceReports} />
      </div>

      <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
        <Card>
          <h2 className="mb-4 text-lg">Daily Attendance Breakdown</h2>
          <BarChart
            data={(charts?.dailyAttendance ?? []).map((a) => ({ label: a.status, value: a.count }))}
            valueSuffix=" students"
            color={chartColors.pine}
            emptyLabel="No attendance recorded for this date"
          />
        </Card>

        <Card>
          <h2 className="mb-4 text-lg">Weekly Attendance Trend</h2>
          <LineChart
            data={(charts?.weeklyAttendance ?? []).map((w) => ({
              label: new Date(w.date).toLocaleDateString(undefined, { weekday: 'short' }),
              value: w.presentPercentage,
            }))}
            valueSuffix="%"
            color={chartColors.gold}
            emptyLabel="No attendance trend data"
          />
        </Card>
      </div>
    </div>
  );
}
