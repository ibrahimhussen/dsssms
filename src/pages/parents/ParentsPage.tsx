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
import { Modal } from '../../components/ui/Modal';
import { CreateParentModal } from './CreateParentModal';
import type { ParentSummary, CreateParentResult, ListParentsParams } from '../../types/parent';
import { useAuth } from '../../context/AuthContext';

export function ParentsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ListParentsParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [issuedCredentials, setIssuedCredentials] = useState<CredentialsItem[]>([]);
  const [resetTarget, setResetTarget] = useState<ParentSummary | null>(null);
  const [resetReason, setResetReason] = useState('');
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
    if (!resetTarget || !resetReason.trim()) return;
    setResetError(null);
    try {
      const result = await resetPassword.mutateAsync({ parentId: resetTarget.parentId, reason: resetReason.trim() });
      const targetName = resetTarget.fullName;
      setResetTarget(null);
      setResetReason('');
      setIssuedCredentials([
        {
          label: `Parent — ${targetName}`,
          username: result.username,
          temporaryPassword: result.temporaryPassword,
        },
      ]);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Password reset failed.');
      setResetTarget(null);
      setResetReason('');
    }
  }

  const columns: Column<ParentSummary>[] = [
    { header: 'Full name', render: (p) => p.fullName },
    { header: 'Username', className: 'font-mono text-[0.8125rem]', render: (p) => p.username },
    { header: 'Phone', render: (p) => p.phoneNumber ?? '—' },
    {
      header: 'Status',
      render: (p) =>
        p.status === 'ACTIVE' ? (
          <span className="inline-flex items-center rounded-full bg-pine-50 px-2 py-0.5 text-xs font-medium text-pine-700">Active</span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Inactive</span>
        ),
    },
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
              <Button variant="ghost" onClick={() => { setResetTarget(p); setResetReason(''); }}>
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

      {/* Reset password confirmation with required reason */}
      <Modal
        title="Reset parent password"
        isOpen={Boolean(resetTarget)}
        onClose={() => { setResetTarget(null); setResetReason(''); }}
      >
        {resetTarget && (
          <>
            <p className="text-[0.9375rem] text-ink-700">
              Reset the password for <strong>{resetTarget.fullName}</strong> ({resetTarget.username})?
              <br />
              Account status: <span className={resetTarget.status === 'ACTIVE' ? 'font-medium text-pine-700' : 'font-medium text-slate-600'}>
                {resetTarget.status === 'ACTIVE' ? 'Active' : 'Inactive'}
              </span>
              <br />
              A temporary password will be generated. The parent must change it on their next login.
              All active sessions will be invalidated.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-ink-700">
                Reason for reset <span className="text-danger-600">*</span>
              </label>
              <textarea
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pine-500 focus:outline-none focus:ring-1 focus:ring-pine-500"
                rows={3}
                maxLength={500}
                placeholder="e.g. Parent forgot password — requested via phone call"
                value={resetReason}
                onChange={(e) => setResetReason(e.target.value)}
                autoFocus
              />
              <p className="mt-1 text-xs text-slate-400">
                This reason is recorded in the audit log. {resetReason.length}/500 characters.
              </p>
            </div>

            {resetError && (
              <p className="mt-3 rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-600" role="alert">
                {resetError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => { setResetTarget(null); setResetReason(''); }}
                disabled={resetPassword.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleConfirmReset()}
                isLoading={resetPassword.isPending}
                disabled={!resetReason.trim()}
              >
                Reset password
              </Button>
            </div>
          </>
        )}
      </Modal>

      <CredentialsDialog
        isOpen={issuedCredentials.length > 0}
        onClose={() => setIssuedCredentials([])}
        items={issuedCredentials}
      />
    </div>
  );
}
