/**
 * ReplaceOfficeModal
 *
 * Allows an Admin to replace the current active Director or Vice Director.
 * Shows the outgoing officeholder's name, collects the incoming person's
 * details, then calls POST /users/staff/replace-office.
 *
 * The replacement is atomic on the backend: the outgoing user is deactivated
 * and the incoming user is created in a single transaction. If either step
 * fails the DB rolls back and neither change is persisted.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CredentialsDialog } from '../../components/ui/CredentialsDialog';
import { useReplaceOfficeHolder } from '../../hooks/useUsers';
import type { ReplaceOfficeResult, UserSummary } from '../../types/user';

interface Props {
  /** Which role is being replaced — determines the modal title. */
  role: 'DIRECTOR' | 'VICE_DIRECTOR';
  /** The current active officeholder who will be deactivated. */
  outgoing: UserSummary;
  onClose: () => void;
}

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName:  z.string().trim().min(1, 'Last name is required').max(100),
  email:     z.string().trim().email('Invalid email address').or(z.literal('')).optional(),
});
type FormValues = z.infer<typeof schema>;

export function ReplaceOfficeModal({ role, outgoing, onClose }: Props) {
  const replace = useReplaceOfficeHolder();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<FormValues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ReplaceOfficeResult | null>(null);

  const roleLabel = role === 'DIRECTOR' ? 'Director' : 'Vice Director';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    setServerError(null);
    setPending(values);
    setConfirmOpen(true);
  }

  async function executeReplace() {
    if (!pending) return;
    setConfirmOpen(false);
    try {
      const res = await replace.mutateAsync({
        role,
        outgoingUserId: outgoing.userId,
        firstName: pending.firstName,
        lastName:  pending.lastName,
        email: pending.email || undefined,
      });
      setResult(res);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Replacement failed. Please try again.');
    }
  }

  if (result) {
    return (
      <CredentialsDialog
        isOpen
        onClose={onClose}
        items={[
          {
            label: `New ${roleLabel} — ${result.incoming.fullName}`,
            username: result.credentials.username,
            temporaryPassword: result.credentials.temporaryPassword,
          },
        ]}
      />
    );
  }

  return (
    <>
      <Modal
        title={`Replace ${roleLabel}`}
        isOpen
        onClose={onClose}
        widthClassName="max-w-lg"
      >
        {/* Outgoing officeholder notice */}
        <div className="mb-5 rounded-lg border border-gold-200 bg-gold-50 px-4 py-3">
          <p className="text-sm font-semibold text-gold-800">Current {roleLabel}</p>
          <p className="mt-0.5 text-sm text-gold-700">
            <span className="font-medium">{outgoing.fullName}</span>{' '}
            <span className="font-mono text-xs text-gold-600">({outgoing.username})</span>
          </p>
          <p className="mt-1.5 text-xs text-gold-600">
            This account will be <strong>deactivated</strong> when the replacement is confirmed.
            All academic records, audit history, and past actions are preserved.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
          <p className="mb-3 text-sm font-semibold text-ink-700">New {roleLabel} details</p>

          <div className="grid grid-cols-2 gap-x-4">
            <TextField
              label="First name"
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <TextField
              label="Last name"
              error={errors.lastName?.message}
              {...register('lastName')}
            />
          </div>

          <TextField
            label="Email (optional)"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {serverError && (
            <p className="mb-4 rounded-lg bg-danger-100 px-3 py-2.5 text-sm text-danger-600" role="alert">
              {serverError}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={replace.isPending}>
              Review replacement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation step — shows outgoing and incoming names */}
      {pending && (
        <ConfirmDialog
          isOpen={confirmOpen}
          title={`Confirm ${roleLabel} replacement`}
          message={[
            `Outgoing: ${outgoing.fullName} (${outgoing.username}) — will be deactivated.`,
            '',
            `Incoming: ${pending.firstName} ${pending.lastName}${pending.email ? ` (${pending.email})` : ''} — new account will be created.`,
            '',
            'This operation is atomic. If anything fails, no changes are saved.',
          ].join('\n')}
          confirmLabel={`Replace ${roleLabel}`}
          isDangerous
          isLoading={replace.isPending}
          onConfirm={() => void executeReplace()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}
