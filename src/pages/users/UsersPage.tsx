import { useState } from 'react';
import { useUsers, useUpdateUserStatus, useResetUserPassword } from '../../hooks/useUsers';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/SelectField';
import { TextField } from '../../components/ui/TextField';
import { LedgerRule } from '../../components/ui/LedgerRule';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { CreateStaffModal } from './CreateStaffModal';
import { UserPermissionsModal } from './UserPermissionsModal';
import { getRoleLabel } from '../../lib/role-labels';
import type { UserSummary, CreateStaffResult, ListUsersParams } from '../../types/user';
import type { RoleName, UserStatus } from '../../types/auth';

const STAFF_ROLES: RoleName[] = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'TEACHER'];

function statusTone(status: UserStatus): 'positive' | 'warning' | 'danger' {
  if (status === 'ACTIVE') return 'positive';
  if (status === 'LOCKED') return 'danger';
  return 'warning';
}

export function UsersPage() {
  const [filters, setFilters] = useState<ListUsersParams>({ page: 1, limit: 20 });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<UserSummary | null>(null);
  const [issuedCredentials, setIssuedCredentials] = useState<CreateStaffResult | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; temporaryPassword: string } | null>(null);

  const { data, isLoading, error, refetch } = useUsers(filters);
  const updateStatus = useUpdateUserStatus();
  const resetPassword = useResetUserPassword();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  function updateFilter<K extends keyof ListUsersParams>(key: K, value: ListUsersParams[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  async function handleToggleStatus(user: UserSummary) {
    setStatusError(null);
    const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateStatus.mutateAsync({ userId: user.userId, status: nextStatus });
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Could not update status.');
    }
  }

  async function handleResetPassword(user: UserSummary) {
    setResetError(null);
    try {
      const result = await resetPassword.mutateAsync(user.userId);
      setResetResult(result);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Could not reset password.');
    }
  }

  const columns: Column<UserSummary>[] = [
    { header: 'Name', render: (u) => u.fullName },
    { header: 'Username', className: 'font-mono text-[0.8125rem]', render: (u) => u.username },
    { header: 'Role', render: (u) => getRoleLabel(u.role) },
    { header: 'Status', render: (u) => <Badge tone={statusTone(u.status)}>{u.status}</Badge> },
    {
      header: 'Last login',
      render: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'),
    },
    {
      header: 'Actions',
      render: (u) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setPermissionsUser(u)}>
            Permissions
          </Button>
          <Button variant="ghost" onClick={() => void handleToggleStatus(u)} disabled={updateStatus.isPending}>
            {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant="ghost" onClick={() => void handleResetPassword(u)} disabled={resetPassword.isPending}>
            Reset password
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-full">
      <h1 className="text-2xl">Staff Accounts</h1>
      <LedgerRule />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Role"
            className="min-w-[160px]"
            value={filters.role ?? ''}
            onChange={(e) => updateFilter('role', (e.target.value || undefined) as RoleName | undefined)}
          >
            <option value="">All roles</option>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {getRoleLabel(role)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            className="min-w-[160px]"
            value={filters.status ?? ''}
            onChange={(e) => updateFilter('status', (e.target.value || undefined) as UserStatus | undefined)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOCKED">Locked</option>
          </SelectField>

          <TextField
            label="Search"
            className="min-w-[220px]"
            placeholder="Name, username, or email"
            defaultValue={filters.search ?? ''}
            onChange={(e) => updateFilter('search', e.target.value || undefined)}
          />
        </div>

        <Button onClick={() => setCreateOpen(true)}>Add staff</Button>
      </div>

      {statusError && <ErrorMessage error={new Error(statusError)} className="mb-4" />}
      {resetError && <ErrorMessage error={new Error(resetError)} className="mb-4" />}

      <Table
        columns={columns}
        rows={data?.items ?? []}
        getRowKey={(u) => u.userId}
        isLoading={isLoading}
        error={error}
        onRetry={() => void refetch()}
        emptyMessage="No staff accounts match these filters."
      />

      {data && <Pagination meta={data.meta} onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))} />}

      <CreateStaffModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setIssuedCredentials(result);
        }}
      />

      <UserPermissionsModal
        user={permissionsUser}
        onClose={() => setPermissionsUser(null)}
      />

      <CredentialsDialog
        isOpen={Boolean(issuedCredentials)}
        onClose={() => setIssuedCredentials(null)}
        items={
          issuedCredentials
            ? [
                {
                  label: 'Staff account',
                  username: issuedCredentials.credentials.username,
                  temporaryPassword: issuedCredentials.credentials.temporaryPassword,
                },
              ]
            : []
        }
      />

      <CredentialsDialog
        isOpen={Boolean(resetResult)}
        onClose={() => setResetResult(null)}
        items={
          resetResult ? [{ label: 'Password reset', username: resetResult.username, temporaryPassword: resetResult.temporaryPassword }] : []
        }
      />
    </div>
  );
}
