import { useState } from 'react';
import { useDirectorDashboard } from '../../hooks/useDashboardStats';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart, LineChart } from '../../components/ui/Charts';
import { chartColors } from '../../components/ui/chart-colors';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';

interface AtRiskStudent {
  id: number;
  name: string;
  admissionNumber: string;
  classroom: string;
  avgGrade: number;
  attendanceRate: number;
  riskReason: string;
}

const MOCK_AT_RISK_STUDENTS: AtRiskStudent[] = [
  {
    id: 101,
    name: 'Samuel Tadesse',
    admissionNumber: 'ADM-2025-014',
    classroom: 'Grade 9 B',
    avgGrade: 44.5,
    attendanceRate: 72.0,
    riskReason: 'Low academic average (<50%) & attendance <75%',
  },
  {
    id: 102,
    name: 'Bethlehem Haile',
    admissionNumber: 'ADM-2025-029',
    classroom: 'Grade 10 A',
    avgGrade: 48.0,
    attendanceRate: 88.5,
    riskReason: 'Low academic average in Mathematics & Physics',
  },
  {
    id: 103,
    name: 'Yonas Kebede',
    admissionNumber: 'ADM-2025-042',
    classroom: 'Grade 11 C',
    avgGrade: 62.0,
    attendanceRate: 68.0,
    riskReason: 'Chronic unexcused absences (<75% attendance)',
  },
];

export function SchoolPerformancePage() {
  const { data, isLoading } = useDirectorDashboard();
  const [activeTab, setActiveTab] = useState<'overview' | 'at-risk' | 'trends'>('overview');

  const stats = data?.stats;
  const charts = data?.charts;

  const atRiskColumns: Column<AtRiskStudent>[] = [
    {
      header: 'Student Name',
      render: (s) => (
        <div>
          <div className="font-medium text-ink-900">{s.name}</div>
          <div className="text-xs text-slate-500">{s.admissionNumber}</div>
        </div>
      ),
    },
    { header: 'Classroom', render: (s) => s.classroom },
    {
      header: 'Average Grade',
      render: (s) => (
        <Badge tone={s.avgGrade < 50 ? 'danger' : 'neutral'}>
          {s.avgGrade.toFixed(1)}%
        </Badge>
      ),
    },
    {
      header: 'Attendance Rate',
      render: (s) => (
        <Badge tone={s.attendanceRate < 75 ? 'danger' : 'positive'}>
          {s.attendanceRate.toFixed(1)}%
        </Badge>
      ),
    },
    {
      header: 'Risk Factors',
      render: (s) => <span className="text-xs text-danger-600 font-medium">{s.riskReason}</span>,
    },
  ];

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">School Performance &amp; Analytics</h1>
          <p className="text-sm text-slate-500">
            Full supervisory dashboard: overall student performance, attendance, teacher stats, pass/fail rates &amp; trends
          </p>
        </div>
      </div>
      <LedgerRule />

      {/* Top Level Metric Summary Cards */}
      <div className="mb-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Overall Avg Score" value={isLoading ? '—' : `${stats?.overallAverageScore ?? 0}%`} />
        <StatCard label="Attendance Rate" value={isLoading ? '—' : `${stats?.attendanceRateToday ?? 0}%`} />
        <StatCard label="Total Students" value={isLoading ? '—' : stats?.totalStudents} />
        <StatCard label="Total Teachers" value={isLoading ? '—' : stats?.totalTeachers} />
        <StatCard label="Pending Reports" value={isLoading ? '—' : stats?.pendingAcademicReports} />
        <StatCard label="At-Risk Students" value={isLoading ? '—' : MOCK_AT_RISK_STUDENTS.length} />
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'border-b-2 border-pine-700 text-pine-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Performance Overview
          </button>
          <button
            onClick={() => setActiveTab('at-risk')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'at-risk'
                ? 'border-b-2 border-pine-700 text-pine-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            At-Risk Students ({MOCK_AT_RISK_STUDENTS.length})
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'trends'
                ? 'border-b-2 border-pine-700 text-pine-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            School-Wide Trends &amp; Attendance
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
          <Card>
            <h2 className="mb-4 text-lg">Class Performance (Average Scores)</h2>
            <BarChart
              data={(charts?.performanceByGrade ?? []).map((p) => ({ label: p.classroomLabel, value: p.averageScore }))}
              valueSuffix="%"
              emptyLabel="No academic reports generated yet"
            />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg">Pass Rate Analysis by Class</h2>
            <BarChart
              data={(charts?.passRateAnalysis ?? []).map((p) => ({ label: p.classroomLabel, value: p.passRate }))}
              valueSuffix="%"
              color={chartColors.pine}
              emptyLabel="No academic reports generated yet"
            />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg">Subject Performance Breakdown</h2>
            <BarChart
              data={(charts?.subjectPerformance ?? []).map((p) => ({ label: p.subjectName, value: p.averageScore }))}
              valueSuffix="%"
              color={chartColors.gold}
              emptyLabel="No grades entered yet"
            />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg">Teacher Statistics Summary</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Total Active Faculty</span>
                <span className="font-semibold text-ink-900">{stats?.totalTeachers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Student-to-Teacher Ratio</span>
                <span className="font-semibold text-ink-900">
                  {stats?.totalTeachers ? Math.round((stats.totalStudents / stats.totalTeachers) * 10) / 10 : 0}:1
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm font-medium text-slate-600">Top Performing Section</span>
                <span className="font-semibold text-pine-700">
                  {stats?.topPerformingGrade ? `${stats.topPerformingGrade.classroomLabel} (${stats.topPerformingGrade.averageScore}%)` : 'N/A'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'at-risk' && (
        <Card>
          <div className="mb-4">
            <h2 className="text-lg">At-Risk Students Monitoring</h2>
            <p className="text-xs text-slate-500">
              Students identified for early intervention based on low grades (&lt;50%) or poor attendance (&lt;75%)
            </p>
          </div>
          <Table columns={atRiskColumns} rows={MOCK_AT_RISK_STUDENTS} getRowKey={(s) => s.id} />
        </Card>
      )}

      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 gap-5">
          <Card>
            <h2 className="mb-4 text-lg">Attendance Performance Trend (Last 7 Days)</h2>
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
        </div>
      )}
    </div>
  );
}
