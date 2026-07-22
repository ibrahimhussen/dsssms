import type { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="p-6 text-center text-slate-500">
      <p className="mb-1 font-semibold text-ink-700">{title}</p>
      {description && <p className="mb-3">{description}</p>}
      {action}
    </div>
  );
}
