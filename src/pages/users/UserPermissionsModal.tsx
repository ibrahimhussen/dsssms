import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useUserPermissions, useGrantPermission, useRevokePermission } from '../../hooks/useUsers';
import type { UserSummary } from '../../types/user';

interface Props {
  user: UserSummary | null;
  onClose: () => void;
}

/** Common permissions that can be granted temporarily to staff */
const SUGGESTED_PERMISSIONS = [
  { value: 'students:view', label: 'View Students' },
  { value: 'students:create', label: 'Register Students' },
  { value: 'students:update', label: 'Update Students' },
  { value: 'students:bulk_import', label: 'Bulk Import Students' },
  { value: 'students:transfer', label: 'Transfer Students Out' },
  { value: 'students:delete', label: 'Delete Students' },
];

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function UserPermissionsModal({ user, onClose }: Props) {
  const [customPermission, setCustomPermission] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);

  const { data: permissions, isLoading } = useUserPermissions(user?.userId ?? 0, Boolean(user));
  const grantPermission = useGrantPermission(user?.userId ?? 0);
  const revokePermission = useRevokePermission(user?.userId ?? 0);

  async function handleGrant(permissionValue: string) {
    if (!permissionValue.trim()) return;
    setGrantError(null);
    try {
      await grantPermission.mutateAsync({
        permission: permissionValue.trim(),
        expiresAt: expiresAt || undefined,
      });
      setCustomPermission('');
      setExpiresAt('');
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Failed to grant permission.');
    }
  }

  async function handleRevoke(permissionId: number) {
    try {
      await revokePermission.mutateAsync(permissionId);
    } catch {
      // Errors handled silently — UI will re-sync on next render
    }
  }

  const activePermissions = permissions?.filter((p) => !isExpired(p.expiresAt)) ?? [];
  const expiredPermissions = permissions?.filter((p) => isExpired(p.expiresAt)) ?? [];

  return (
    <Modal
      title={`Permissions — ${user?.fullName ?? ''}`}
      isOpen={Boolean(user)}
      onClose={onClose}
      widthClassName="max-w-[640px]"
    >
      <div>
        {/* ── Current Permissions ────────────────────────────────────── */}
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Active permissions
        </p>

        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {!isLoading && activePermissions.length === 0 && (
          <p className="mb-4 text-sm text-slate-400">No active permissions granted to this user.</p>
        )}

        {activePermissions.length > 0 && (
          <div className="mb-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {activePermissions.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <span className="font-mono text-[0.8125rem] text-ink-900">{p.permission}</span>
                  {p.expiresAt && (
                    <span className="ml-2 text-xs text-amber-600">
                      Expires {formatDate(p.expiresAt)}
                    </span>
                  )}
                  {!p.expiresAt && (
                    <span className="ml-2 text-xs text-slate-400">Permanent</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void handleRevoke(p.id)}
                  disabled={revokePermission.isPending}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}

        {expiredPermissions.length > 0 && (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
              {expiredPermissions.length} expired permission{expiredPermissions.length !== 1 ? 's' : ''}
            </summary>
            <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 opacity-60">
              {expiredPermissions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-mono text-[0.8125rem] text-slate-500 line-through">{p.permission}</span>
                  <Badge tone="warning">Expired</Badge>
                  <Button
                    variant="ghost"
                    onClick={() => void handleRevoke(p.id)}
                    disabled={revokePermission.isPending}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* ── Quick Grant ─────────────────────────────────────────────── */}
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Grant permission
        </p>

        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTED_PERMISSIONS.map((sp) => {
            const alreadyHas = activePermissions.some((p) => p.permission === sp.value);
            return (
              <button
                key={sp.value}
                type="button"
                disabled={alreadyHas || grantPermission.isPending}
                onClick={() => void handleGrant(sp.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  alreadyHas
                    ? 'cursor-default border-green-200 bg-green-50 text-green-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-pine-300 hover:bg-pine-50 hover:text-pine-700'
                }`}
              >
                {alreadyHas ? '✓ ' : '+ '}{sp.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 bg-paper-50 p-3">
          <p className="mb-2 text-xs text-slate-500">Custom permission string (advanced):</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <TextField
              label="Permission"
              placeholder="e.g. students:create"
              value={customPermission}
              onChange={(e) => setCustomPermission(e.target.value)}
            />
            <div className="flex items-end">
              <Button
                onClick={() => void handleGrant(customPermission)}
                disabled={!customPermission.trim() || grantPermission.isPending}
                isLoading={grantPermission.isPending}
              >
                Grant
              </Button>
            </div>
          </div>
          <TextField
            label="Expires at (optional — leave blank for permanent)"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>

        {grantError && (
          <p className="mt-3 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
            {grantError}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
