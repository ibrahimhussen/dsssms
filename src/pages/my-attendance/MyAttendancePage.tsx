import { useState } from 'react';
import { useMyAttendanceSummary } from '../../hooks/useDashboardData';
import { useMyAttendanceHistory } from '../../hooks/useAttendance';
import { StatCard } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import type { AttendanceHistoryParams, AttendanceRecord, AttendanceStatus } from '../../types/attendance';

const STATUS_TONE: Record<AttendanceStatus, 'positive' | 'danger' | 'warning' | 'neutral'> = {
  PRESENT: 'positive',
  ABSENT: 'danger',
  LATE: 'warning',
  EXCUSED: 'neutral',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  EXCUSED: 'Excused',
};

export function MyAttendancePage() {
  const [filters, setFilters] = useState<AttendanceHistoryParams>({ page: 1, limit: 20 });
  const { data: summary, isLoading: isSummaryLoading } = useMyAttendanceSummary();
  const { data: historyData, isLoading: isHistoryLoading } = useMyAttendanceHistory(filters);

  const columns: Column<AttendanceRecord>[] = [
    { header: 'Date', render: (r) => new Date(r.attendanceDate).toLocaleDateString() },
    {
      header: 'Status',
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge>,
    },
    { header: 'Remarks', render: (r) => r.remarks ?? '—' },
    { header: 'Recorded by', render: (r) => `${r.recordedBy.firstName} ${r.recordedBy.lastName}` },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">My attendance</h1>
      <LedgerRule />

      <div className="mb-7 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <StatCard label="Present" value={isSummaryLoading ? '—' : summary?.present} />
        <StatCard label="Absent" value={isSummaryLoading ? '—' : summary?.absent} />
        <StatCard label="Late" value={isSummaryLoading ? '—' : summary?.late} />
        <StatCard label="Excused" value={isSummaryLoading ? '—' : summary?.excused} />
        <StatCard label="Attendance rate" value={isSummaryLoading ? '—' : `${summary?.presentPercentage ?? 0}%`} />
      </div>

      <h2 className="mb-3 text-lg">History</h2>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <TextField
          label="From"
          type="date"
          value={filters.from ?? ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value || undefined, page: 1 }))}
        />
        <TextField
          label="To"
          type="date"
          value={filters.to ?? ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value || undefined, page: 1 }))}
        />
      </div>

      <Table
        columns={columns}
        rows={historyData?.items ?? []}
        getRowKey={(r) => r.attendanceId}
        isLoading={isHistoryLoading}
        emptyMessage="No attendance records yet."
      />

      {historyData && (
        <Pagination meta={historyData.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />
      )}
    </div>
  );
}
