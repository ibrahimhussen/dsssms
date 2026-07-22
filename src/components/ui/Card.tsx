import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className)}>{children}</div>;
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="font-display text-3xl font-semibold text-pine-900">{value}</span>
      <span className="text-[0.8125rem] text-slate-500">{label}</span>
    </Card>
  );
}
