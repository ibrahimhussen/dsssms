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

export function CredentialsDialog({ isOpen, onClose, items }: CredentialsDialogProps) {
  return (
    <Modal title="Temporary credentials" isOpen={isOpen} onClose={onClose}>
      <p className="mb-4 text-sm text-ink-700">
        Share these credentials securely with the account holder. They will not be shown again.
      </p>

      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.username} className="rounded-lg border border-paper-100 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="flex flex-col gap-1 font-mono text-sm">
              <div>
                <span className="text-slate-500">Username: </span>
                {item.username}
              </div>
              <div>
                <span className="text-slate-500">Password: </span>
                {item.temporaryPassword}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}