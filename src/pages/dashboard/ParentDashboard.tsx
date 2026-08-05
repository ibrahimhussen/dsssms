import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  useMyParentProfile,
  useChildAttendanceSummary,
  useChildAttendanceTrend,
} from '../../hooks/useDashboardData';
import { useStudentReportHistory } from '../../hooks/useAcademicReports';
import { Card, StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { LineChart } from '../../components/ui/Charts';

export function ParentDashboard() {
  const { data: profile, isLoading: isProfileLoading } = useMyParentProfile();
  const [selectedStudentId, setSelectedStudentId] = useState<number | undefined>(undefined);

  const children = profile?.children ?? [];
  const activeStudentId = selectedStudentId ?? children[0]?.studentId;
  const activeChild = children.find((c) => c.studentId === activeStudentId);

  const { data: attendanceSummary, isLoading: isAttendanceLoading } = useChildAttendanceSummary(activeStudentId);
  const { data: attendanceTrend, isLoading: isAttendanceTrendLoading } = useChildAttendanceTrend(activeStudentId);
  const { data: reports, isLoading: isReportsLoading } = useStudentReportHistory(activeStudentId);

  const sortedReports = reports
    ? [...reports].sort((a, b) => (a.academicYear + a.semester).localeCompare(b.academicYear + b.semester))
    : [];
  const latestReport = sortedReports[sortedReports.length - 1];

  return (
    <>
      <Card className="mb-5">
        <h2 className="mb-3 text-lg">Your children</h2>

        {isProfileLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : children.length === 0 ? (
          <EmptyState title="No linked students" description="Contact the school administrator if this seems wrong." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {children.map((child) => (
              <button
                key={child.studentId}
                type="button"
                onClick={() => setSelectedStudentId(child.studentId)}
                className={clsx(
                  'rounded-lg border px-4 py-2 text-left text-sm transition-colors',
                  child.studentId === activeStudentId
                    ? 'border-pine-900 bg-pine-900 text-paper-50'
                    : 'border-slate-200 text-ink-900 hover:bg-paper-100'
                )}
              >
                <span className="block font-semibold">
                  {child.firstName} {child.lastName}
                </span>
                <span className={clsx('font-mono text-[0.75rem]', child.studentId === activeStudentId ? 'text-paper-100' : 'text-slate-500')}>
                  {child.admissionNumber}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {activeChild && (
        <>
          <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
            <StatCard label="Attendance rate" value={isAttendanceLoading ? '—' : `${attendanceSummary?.presentPercentage ?? 0}%`} />
            <StatCard
              label="Overall average"
              value={
                isReportsLoading ? (
                  '—'
                ) : latestReport ? (
                  <>
                    {latestReport.averageMark}%{latestReport.rank && <Badge tone="positive"> Rank #{latestReport.rank}</Badge>}
                  </>
                ) : (
                  '—'
                )
              }
            />
            <StatCard label="Days present" value={isAttendanceLoading ? '—' : attendanceSummary?.present} />
            <StatCard label="Days absent" value={isAttendanceLoading ? '—' : attendanceSummary?.absent} />
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            <Link to="/notifications" className="text-sm font-semibold text-pine-700 hover:underline">
              Contact school / notifications
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
            <Card>
              <h2 className="mb-4 text-lg">{activeChild.firstName}'s academic progress</h2>
              {isReportsLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <LineChart
                  data={sortedReports.map((r) => ({
                    label: `${r.semester === 'SEMESTER_1' ? 'S1' : 'S2'} ${r.academicYear}`,
                    value: r.averageMark,
                  }))}
                  valueSuffix="%"
                  emptyLabel="No report cards yet"
                />
              )}
            </Card>

            <Card>
              <h2 className="mb-4 text-lg">Attendance history</h2>
              {isAttendanceTrendLoading ? (
                <p className="text-sm text-slate-500">Loading…</p>
              ) : (
                <LineChart data={attendanceTrend ?? []} valueSuffix="%" emptyLabel="No attendance recorded yet" />
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
