import { useState } from 'react';
import { useAuditLogs } from '../../hooks/useAuditLogs';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Badge } from '../../components/ui/Badge';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import type { AuditLogEntry, ListAuditLogsParams } from '../../types/audit-log';

function actionTone(action: string): 'neutral' | 'positive' | 'warning' | 'danger' {
  if (action.includes('DELETE') || action.includes('FAILED') || action.includes('RESTORED')) return 'danger';
  if (action.includes('CREATED') || action.includes('SUCCESS')) return 'positive';
  if (action.includes('UPDATE') || action.includes('RESET')) return 'warning';
  return 'neutral';
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState<ListAuditLogsParams>({ page: 1, limit: 20 });
  const { data, isLoading, error, refetch } = useAuditLogs(filters);

  function updateFilter<K extends keyof ListAuditLogsParams>(key: K, value: ListAuditLogsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const columns: Column<AuditLogEntry>[] = [
    { header: 'When', className: 'whitespace-nowrap text-[0.8125rem]', render: (log) => new Date(log.createdAt).toLocaleString() },
    { header: 'User', render: (log) => (log.username ? `${log.username}${log.role ? ` (${log.role.replace('_', ' ')})` : ''}` : '—') },
    { header: 'Action', render: (log) => <Badge tone={actionTone(log.action)}>{log.action.replace(/_/g, ' ')}</Badge> },
    { header: 'Entity', render: (log) => (log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ''}` : '—') },
    { header: 'IP address', className: 'font-mono text-[0.8125rem]', render: (log) => log.ipAddress ?? '—' },
    {
      header: 'Details',
      className: 'max-w-[280px] truncate text-[0.8125rem] text-slate-500',
      render: (log) => (log.metadata ? JSON.stringify(log.metadata) : '—'),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Audit logs</h1>
      <p className="mb-1 text-[0.9375rem] text-ink-700">A record of security- and data-significant actions across the system.</p>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <TextField
          label="Action"
          className="min-w-[200px]"
          placeholder="e.g. LOGIN_SUCCESS"
          defaultValue={filters.action ?? ''}
          onChange={(e) => updateFilter('action', e.target.value || undefined)}
        />
        <TextField
          label="Entity"
          className="min-w-[160px]"
          placeholder="e.g. User"
          defaultValue={filters.entity ?? ''}
          onChange={(e) => updateFilter('entity', e.target.value || undefined)}
        />
        <TextField
          label="From"
          type="date"
          className="min-w-[160px]"
          onChange={(e) => updateFilter('from', e.target.value || undefined)}
        />
        <TextField
          label="To"
          type="date"
          className="min-w-[160px]"
          onChange={(e) => updateFilter('to', e.target.value || undefined)}
        />
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(log) => log.id}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        emptyMessage="No audit log entries match these filters."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}
    </div>
  );
}
