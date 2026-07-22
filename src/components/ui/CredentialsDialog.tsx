import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface CredentialsItem {
  label: string;
  username: string;
  temporaryPassword: string;
}

interface CredentialsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: CredentialsItem[];
}

/**
 * Shows one or more sets of freshly-issued login credentials. This is the
 * only time the temporary password is ever visible — the backend never
 * returns it again — so the dialog leads with an explicit warning and offers
 * a one-click copy of everything shown.
 */
export function CredentialsDialog({ isOpen, onClose, items }: CredentialsDialogProps) {
  const [copied, setCopied] = useState(false);

  if (items.length === 0) return null;

  async function handleCopyAll() {
    const text = items
      .map((item) => `${item.label}\nUsername: ${item.username}\nTemporary password: ${item.temporaryPassword}`)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal title="Account created" isOpen={isOpen} onClose={onClose}>
      <p className="mb-4.5 rounded-lg bg-gold-100 px-3.5 py-3 text-sm text-gold-600">
        These credentials are shown only once. Share them securely with each account holder now.
      </p>

      {items.map((item, index) => (
        <div key={index} className="mb-4 border-b border-paper-100 pb-4 last:mb-0 last:border-b-0 last:pb-0">
          <p className="mb-2 text-[0.8125rem] font-bold tracking-wide text-pine-700 uppercase">{item.label}</p>
          <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-[0.8125rem] font-semibold text-slate-500">Username</dt>
            <dd className="m-0 font-mono text-[0.9375rem] font-semibold">{item.username}</dd>
            <dt className="text-[0.8125rem] font-semibold text-slate-500">Temporary password</dt>
            <dd className="m-0 font-mono text-[0.9375rem] font-semibold">{item.temporaryPassword}</dd>
          </dl>
        </div>
      ))}

      <div className="mt-2 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => void handleCopyAll()}>
          {copied ? 'Copied ✓' : 'Copy all to clipboard'}
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}
