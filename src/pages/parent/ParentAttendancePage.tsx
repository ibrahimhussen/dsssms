import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMyParentProfile } from '../../hooks/useParents';
import { useStudentAttendanceSummary, useStudentAttendanceHistory } from '../../hooks/useAttendance';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import type { Column } from '../../components/ui/Table';
import type { AttendanceRecord, AttendanceHistoryParams, AttendanceStatus } from '../../types/attendance';

const STATUS_TONE: Record<AttendanceStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  PRESENT: 'positive', ABSENT: 'danger', LATE: 'warning', EXCUSED: 'neutral',
};
const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', EXCUSED: 'Excused',
};

export function ParentAttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useMyParentProfile();

  const selectedId = searchParams.get('studentId')
    ? Number(searchParams.get('studentId'))
    : profile?.children[0]?.studentId;

  const [filters, setFilters] = useState<AttendanceHistoryParams>({ page: 1, limit: 20 });

  const { data: summary, isLoading: summaryLoading } = useStudentAttendanceSummary(selectedId);
  const { data: historyData, isLoading: historyLoading } = useStudentAttendanceHistory(selectedId, filters);

  const selectedChild = profile?.children.find((c) => c.studentId === selectedId);

  const columns: Column<AttendanceRecord>[] = [
    { header: 'Date',        render: (r) => new Date(r.attendanceDate).toLocaleDateString() },
    { header: 'Status',      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
    { header: 'Remarks',     render: (r) => r.remarks ?? '—' },
    { header: 'Recorded by', render: (r) => `${r.recordedBy.firstName} ${r.recordedBy.lastName}` },
  ];

  if (profileLoading) return (
    <div className="flex items-center gap-2 py-16 text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-pine-700" />
      <span className="text-sm">Loading…</span>
    </div>
  );

  if (!profile?.children.length) return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-ink-900">Attendance</h1>
      <LedgerRule />
      <EmptyState title="No children linked" description="Contact the school to link your children to your account." />
    </div>
  );

  return (
    <div className="max-w-full">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/parent/children" className="mb-1 inline-flex items-center text-xs font-medium text-slate-500 hover:text-pine-700">
            ← Academic Overview
          </Link>
          <h1 className="text-2xl font-semibold text-ink-900">Attendance</h1>
          {selectedChild && (
            <p className="mt-0.5 text-sm text-slate-500">
              {selectedChild.firstName} {selectedChild.lastName} · {selectedChild.admissionNumber}
            </p>
          )}
        </div>
        {profile.children.length > 1 && (
          <SelectField
            label="Child"
            className="min-w-[200px]"
            value={selectedId ?? ''}
            onChange={(e) => setSearchParams({ studentId: e.target.value })}
          >
            {profile.children.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.firstName} {c.lastName}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <LedgerRule />

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <StatCard label="Present"  value={summaryLoading ? '—' : summary?.present} />
        <StatCard label="Absent"   value={summaryLoading ? '—' : summary?.absent} />
        <StatCard label="Late"     value={summaryLoading ? '—' : summary?.late} />
        <StatCard label="Excused"  value={summaryLoading ? '—' : summary?.excused} />
        <StatCard label="Rate"     value={summaryLoading ? '—' : `${summary?.presentPercentage ?? 0}%`} />
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <TextField label="From" type="date" value={filters.from ?? ''}
          onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value || undefined, page: 1 }))} />
        <TextField label="To" type="date" value={filters.to ?? ''}
          onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value || undefined, page: 1 }))} />
      </div>

      <Table
        columns={columns}
        rows={historyData?.items ?? []}
        getRowKey={(r) => r.attendanceId}
        isLoading={historyLoading}
        emptyMessage="No attendance records found."
      />
      {historyData && (
        <Pagination meta={historyData.meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />
      )}
    </div>
  );
}
