import { useState } from 'react';
import { useTeacherOptions } from '../../hooks/useTeacherOptions';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { Card, StatCard } from '../../components/ui/Card';
import type { UserSummary } from '../../types/user';

export function TeachersPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTeacherOptions();

  const teachers: UserSummary[] = data?.items ?? [];
  const filtered = teachers.filter((t) =>
    t.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (t.email && t.email.toLowerCase().includes(search.toLowerCase())) ||
    t.username.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<UserSummary>[] = [
    {
      header: 'Teacher Name',
      render: (t) => (
        <div>
          <div className="font-medium text-ink-900">{t.fullName}</div>
          <div className="text-xs text-slate-500">@{t.username}</div>
        </div>
      ),
    },
    {
      header: 'Email Address',
      render: (t) => t.email || '—',
    },
    {
      header: 'Status',
      render: (t) => (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {t.status}
        </span>
      ),
    },
    {
      header: 'Account Created',
      render: (t) => new Date(t.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl">Teachers Directory &amp; Monitoring</h1>
          <p className="text-sm text-slate-500">Monitor teacher profiles, academic activity, and active status</p>
        </div>
      </div>
      <LedgerRule />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Teachers" value={isLoading ? '—' : teachers.length} />
        <StatCard label="Active Faculty" value={isLoading ? '—' : teachers.filter((t) => t.status === 'ACTIVE').length} />
        <StatCard label="System Status" value="100% Operational" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TextField
            label="Search Teachers"
            placeholder="Search teachers by name, email, or username..."
            className="w-full max-w-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Table
          columns={columns}
          rows={filtered}
          getRowKey={(t) => t.userId}
          isLoading={isLoading}
          emptyMessage="No teachers match your search term."
        />
      </Card>
    </div>
  );
}
