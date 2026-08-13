import { useState } from 'react';
import { useParents } from '../../hooks/useParents';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import type { CredentialsItem } from '../../components/ui/CredentialsDialog';
import { CreateParentModal } from './CreateParentModal';
import type { ParentSummary, CreateParentResult, ListParentsParams } from '../../types/parent';

export function ParentsPage() {
  const [filters, setFilters] = useState<ListParentsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);

  const { data, isLoading, error, refetch } = useParents(filters);

  function updateFilter<K extends keyof ListParentsParams>(key: K, value: ListParentsParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function handleCreated(result: CreateParentResult) {
    setCreateOpen(false);
    setIssuedCredentials([
      {
        label: `Parent — ${result.parent.fullName}`,
        username: result.credentials.username,
        temporaryPassword: result.credentials.temporaryPassword,
      },
    ]);
  }

  const columns: Column<ParentSummary>[] = [
    { header: 'Full name', render: (p) => p.fullName },
    { header: 'Username', className: 'font-mono text-[0.8125rem]', render: (p) => p.username },
    { header: 'Phone', render: (p) => p.phoneNumber ?? '—' },
    {
      header: 'Linked children',
      render: (p) => (p.children.length > 0 ? p.children.map((c) => `${c.firstName} ${c.lastName}`).join(', ') : '—'),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Parents &amp; guardians</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <TextField
          label="Search"
          className="min-w-[240px]"
          placeholder="Name or phone number"
          defaultValue={filters.search ?? ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
        />

        <Button onClick={() => setCreateOpen(true)}>Add parent</Button>
      </div>

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(p) => p.parentId}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        emptyMessage="No parents match this search."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateParentModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      <CredentialsDialog isOpen={issuedCredentials.length > 0} onClose={() => setIssuedCredentials([])} items={issuedCredentials} />
    </div>
  );
}
