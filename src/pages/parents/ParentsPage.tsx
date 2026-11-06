import { useState } from 'react';
import { useParents, useResetParentPassword } from '../../hooks/useParents';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import type { CredentialsItem } from '../../components/ui/CredentialsDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CreateParentModal } from './CreateParentModal';
import type { ParentSummary, CreateParentResult, ListParentsParams } from '../../types/parent';
import { useAuth } from '../../context/AuthContext';

export function ParentsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ListParentsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);
  const [resetTarget, setResetTarget] = useState<ParentSummary | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useParents(filters);
  const resetPassword = useResetParentPassword();

  const isAdmin = user?.role === 'ADMIN';

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

  async function handleConfirmReset() {
    if (!resetTarget) return;
    setResetError(null);
    try {
      const result = await resetPassword.mutateAsync(resetTarget.parentId);
      setResetTarget(null);
      setIssuedCredentials([
        {
          label: `Parent — ${resetTarget.fullName}`,
          username: result.username,
          temporaryPassword: result.temporaryPassword,
        },
      ]);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Password reset failed.');
      setResetTarget(null);
    }
  }

  const columns: Column<ParentSummary>[] = [
    { header: 'Full name', render: (p) => p.fullName },
    { header: 'Username', className: 'font-mono text-[0.8125rem]', render: (p) => p.username },
    { header: 'Phone', render: (p) => p.phoneNumber ?? '—' },
    {
      header: 'Linked children',
      render: (p) =>
        p.children.length > 0
          ? p.children.map((c) => `${c.firstName} ${c.lastName}`).join(', ')
          : '—',
    },
    ...(isAdmin
      ? [
          {
            header: 'Actions',
            render: (p: ParentSummary) => (
              <Button variant="ghost" onClick={() => setResetTarget(p)}>
                Reset password
              </Button>
            ),
          } satisfies Column<ParentSummary>,
        ]
      : []),
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Parents &amp; guardians</h1>
      <LedgerRule />

      {resetError && (
        <div className="mb-4 rounded-lg border border-danger-200 bg-danger-50 px-4 py-2.5 text-sm text-danger-700">
          {resetError}
        </div>
      )}

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

      {/* Reset password confirmation */}
      <ConfirmDialog
        isOpen={Boolean(resetTarget)}
        title="Reset parent password"
        message={
          resetTarget
            ? `Reset the password for ${resetTarget.fullName} (${resetTarget.username})?\n\nA temporary password will be generated. The parent must change it on their next login. All active sessions will be invalidated.`
            : ''
        }
        confirmLabel="Reset password"
        isDangerous
        isLoading={resetPassword.isPending}
        onConfirm={() => void handleConfirmReset()}
        onCancel={() => setResetTarget(null)}
      />

      <CredentialsDialog
        isOpen={issuedCredentials.length > 0}
        onClose={() => setIssuedCredentials([])}
        items={issuedCredentials}
      />
    </div>
  );
}
